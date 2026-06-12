import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { createLlmClient } from "./llm.js";
import { startPlaywrightMcp } from "./mcp.js";
import { runSpec, type SpecFailure } from "./verify.js";
import { triageFailure, type TriageVerdict } from "./triage.js";

const specPath = process.argv[2];
if (!specPath) {
  console.error("Usage: npm run triage -- tests/approved/us-001-account-creation.spec.ts");
  process.exit(1);
}
const specCode = readFileSync(specPath, "utf-8");

await main();

async function main(): Promise<void> {
  console.log(`▶ Triage for ${specPath}`);
  console.log(`▶ Target app: ${config.sutBaseUrl} | model: ${config.anthropic.model}`);

  console.log("\n=== Running the spec to find failures ===");
  const result = await runSpec(specPath);
  console.log(`${result.total - result.failed}/${result.total} passed`);

  if (result.passed) {
    console.log("\n✓ All tests pass. Nothing to triage.");
    return;
  }

  const mcp = await startPlaywrightMcp();
  const llm = createLlmClient();
  console.log(`▶ Playwright MCP connected (${mcp.tools.length} browser tools)`);

  const triaged: Array<{ failure: SpecFailure; verdict: TriageVerdict | null }> = [];
  for (const failure of result.failures) {
    console.log(`\n=== Triaging: ${failure.title} ===`);
    const verdict = await triageFailure(llm, mcp, failure, specCode);
    triaged.push({ failure, verdict });
    if (verdict) {
      console.log(`[verdict] ${verdict.classification} (${verdict.confidence}): ${verdict.recommended_action}`);
    } else {
      console.log("[verdict] triage agent did not conclude");
    }
  }

  await mcp.close();
  writeArtifacts(specPath, triaged);
}

function writeArtifacts(
  sourceSpec: string,
  triaged: Array<{ failure: SpecFailure; verdict: TriageVerdict | null }>
): void {
  const triageDir = "triage";
  mkdirSync(triageDir, { recursive: true });
  const base = path.basename(sourceSpec).replace(/\.spec\.ts$/, "");

  const lines: string[] = [
    `# Triage report: ${path.basename(sourceSpec)}`,
    "",
    "| Failing test | Classification | Confidence | Recommended action |",
    "| --- | --- | --- | --- |"
  ];

  for (const { failure, verdict } of triaged) {
    if (!verdict) {
      lines.push(`| ${failure.title} | (no verdict) | | re-run triage |`);
      continue;
    }
    lines.push(
      `| ${failure.title} | ${verdict.classification} | ${verdict.confidence} | ${verdict.recommended_action} |`
    );

    if (verdict.classification === "test_rot" && verdict.patched_spec_code) {
      const patchPath = path.join("tests", "proposed", `${base}.patched.spec.ts`);
      writeFileSync(patchPath, verdict.patched_spec_code);
      console.log(`\n✓ test_rot: patched spec written to ${patchPath} (open as a fix PR after review)`);
    }

    if (verdict.classification === "product_bug" && verdict.issue_title) {
      const issueDir = path.join(triageDir, "issues");
      mkdirSync(issueDir, { recursive: true });
      const issuePath = path.join(issueDir, `${base}.md`);
      writeFileSync(
        issuePath,
        `# ${verdict.issue_title}\n\n${verdict.issue_body ?? ""}\n\n---\nFiled by the triage agent from a failing regression test. Evidence:\n\n${verdict.evidence}\n`
      );
      console.log(`\n✓ product_bug: issue draft written to ${issuePath}`);
    }
  }

  for (const { failure, verdict } of triaged) {
    if (!verdict) continue;
    lines.push("", `## ${failure.title}`, "", `- Reasoning: ${verdict.reasoning}`, `- Evidence: ${verdict.evidence}`);
  }

  const reportPath = path.join(triageDir, `${base}.triage.md`);
  writeFileSync(reportPath, `${lines.join("\n")}\n`);
  console.log(`\n✓ Triage report written to ${reportPath}`);
}
