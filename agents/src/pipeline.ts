import { readFileSync, writeFileSync } from "node:fs";
import { config } from "./config.js";
import { createLlmClient } from "./llm.js";
import { startPlaywrightMcp } from "./mcp.js";
import { authoringSystemPrompt } from "./prompts.js";
import { createAgentSession, writeProposedSpec, type SubmittedSpec } from "./agent-runner.js";
import { critiqueSpec } from "./critic.js";
import { runSpec, type SpecFailure } from "./verify.js";

const MAX_CRITIC_ROUNDS = 2;
const MAX_HEAL_ROUNDS = 3;

const storyPath = process.argv[2];
if (!storyPath) {
  console.error("Usage: npm run pipeline -- stories/US-001-account-creation.md");
  process.exit(1);
}
const story = readFileSync(storyPath, "utf-8");

await main();

async function main(): Promise<void> {
  console.log(`▶ Self-correcting QA pipeline for ${storyPath}`);
  console.log(`▶ Target app: ${config.sutBaseUrl} | model: ${config.anthropic.model}`);

  const mcp = await startPlaywrightMcp();
  console.log(`▶ Playwright MCP connected (${mcp.tools.length} browser tools)`);
  const llm = createLlmClient();

  const session = createAgentSession(llm, mcp, authoringSystemPrompt(config.sutBaseUrl));
  session.say(`Here is the user story to cover:\n\n${story}`);

  console.log("\n=== Phase 1: author (explore the live app, draft a spec) ===");
  let spec: SubmittedSpec = await session.runToSubmit(config.maxTurns);

  console.log("\n=== Phase 2: critic (static review against quality rules) ===");
  for (let round = 1; round <= MAX_CRITIC_ROUNDS; round++) {
    const critique = await critiqueSpec(llm, story, spec.spec_code);
    if (critique.approved) {
      console.log(`[critic] approved (round ${round})`);
      break;
    }
    console.log(`[critic] objections (round ${round}):`);
    critique.objections.forEach((objection) => console.log(`  - ${objection}`));
    session.say(
      `A reviewer raised these objections about your spec:\n${critique.objections
        .map((objection) => `- ${objection}`)
        .join("\n")}\n\nRevise and resubmit the full spec via submit_spec. Re-explore with the browser tools if you need to confirm anything.`
    );
    spec = await session.runToSubmit(config.maxTurns);
  }

  const specPath = writeProposedSpec(storyPath, spec);

  console.log("\n=== Phase 3: verify & self-heal (run it, feed failures back) ===");
  let result = await runSpec(specPath);
  console.log(`[verify] round 1: ${result.total - result.failed}/${result.total} passed`);

  for (let round = 1; round < MAX_HEAL_ROUNDS && !result.passed; round++) {
    console.log(`[heal] ${result.failed} failing; feeding failures back to the agent...`);
    session.say(healPrompt(result.failures));
    spec = await session.runToSubmit(config.maxTurns);
    writeProposedSpec(storyPath, spec);
    result = await runSpec(specPath);
    console.log(`[verify] round ${round + 1}: ${result.total - result.failed}/${result.total} passed`);
  }

  await mcp.close();

  console.log("\n=== Result ===");
  if (result.passed) {
    console.log(`✓ The pipeline produced a passing spec on its own: ${specPath}`);
    console.log(`✓ ${result.total}/${result.total} tests pass against the live app.`);
    console.log("View the HTML report: npx playwright show-report");
    console.log("Next: human review, then promote to tests/approved/.");
  } else {
    console.log(`✗ Spec still failing after ${MAX_HEAL_ROUNDS} verify rounds. Left at ${specPath} for human review.`);
    result.failures.forEach((failure) => console.log(`  - ${failure.title}: ${failure.error.split("\n")[0]}`));
    process.exitCode = 1;
  }
}

function healPrompt(failures: SpecFailure[]): string {
  const detail = failures
    .map((failure) => `### ${failure.title}\n${failure.error}`)
    .join("\n\n");
  return `The spec you submitted was run against the live app and some tests failed:

${detail}

Use the browser tools to re-investigate the failing steps on the live app, find the real cause, and submit a corrected full spec via submit_spec. Common runtime causes to check for: an element that is a link rather than a button, a control that stays disabled until another action is taken first, a locator that matches more than one element (scope it), an assertion on text that does not actually appear, or a value that loads slightly after the element does.`;
}
