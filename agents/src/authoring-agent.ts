import { readFileSync } from "node:fs";
import { config } from "./config.js";
import { createLlmClient } from "./llm.js";
import { startPlaywrightMcp } from "./mcp.js";
import { authoringSystemPrompt } from "./prompts.js";
import { createAgentSession, writeProposedSpec } from "./agent-runner.js";

// Author-only entry point: explore the live app and emit one draft spec into
// tests/proposed. For the full author -> critic -> verify -> self-heal loop,
// use the pipeline (npm run pipeline).

const storyPath = process.argv[2];
if (!storyPath) {
  console.error("Usage: npm run author -- stories/US-001-account-creation.md");
  process.exit(1);
}
const story = readFileSync(storyPath, "utf-8");

await main();

async function main(): Promise<void> {
  console.log(`▶ Authoring agent starting for ${storyPath}`);
  console.log(`▶ Target app: ${config.sutBaseUrl} | model: ${config.anthropic.model}`);

  const mcp = await startPlaywrightMcp();
  console.log(`▶ Playwright MCP connected (${mcp.tools.length} browser tools)`);
  const llm = createLlmClient();

  const session = createAgentSession(llm, mcp, authoringSystemPrompt(config.sutBaseUrl));
  session.say(`Here is the user story to cover:\n\n${story}`);

  const spec = await session.runToSubmit(config.maxTurns);
  await mcp.close();

  const specPath = writeProposedSpec(storyPath, spec);
  console.log(`\n✓ Spec written to ${specPath}`);
  console.log(`✓ Coverage map written to ${specPath.replace(/\.spec\.ts$/, ".coverage.md")}`);
  console.log(`\nNext: review it, then run\n  npx playwright test ${specPath}`);
}
