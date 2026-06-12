import type Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import type { McpSession } from "./mcp.js";
import type { SpecFailure } from "./verify.js";

export type Classification = "product_bug" | "test_rot" | "flake";

export interface TriageVerdict {
  classification: Classification;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  evidence: string;
  recommended_action: string;
  // Present when classification is test_rot: the corrected full spec file.
  patched_spec_code?: string;
  // Present when classification is product_bug: a filer-ready issue.
  issue_title?: string;
  issue_body?: string;
}

const SUBMIT_TRIAGE_TOOL: Anthropic.Tool = {
  name: "submit_triage",
  description: "Submit the triage verdict once you have investigated. Call exactly once.",
  input_schema: {
    type: "object",
    properties: {
      classification: {
        type: "string",
        enum: ["product_bug", "test_rot", "flake"],
        description:
          "product_bug: the app genuinely fails the acceptance criterion (the test is right). test_rot: the app still works but the test's locator or assumption is stale (the test is wrong). flake: a timing or environment issue that does not reproduce."
      },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      reasoning: { type: "string", description: "Why you reached this classification." },
      evidence: { type: "string", description: "What you observed on the live app that supports it." },
      recommended_action: { type: "string", description: "What a human should do next." },
      patched_spec_code: {
        type: "string",
        description: "For test_rot only: the complete corrected spec file, ready to open as a fix PR."
      },
      issue_title: { type: "string", description: "For product_bug only: a concise issue title." },
      issue_body: {
        type: "string",
        description: "For product_bug only: repro steps, expected behavior, and actual behavior."
      }
    },
    required: ["classification", "confidence", "reasoning", "evidence", "recommended_action"]
  }
};

function triageSystemPrompt(baseUrl: string): string {
  return `You are a QA triage engineer. A regression test failed in CI. Your job is to decide why, so a human does not have to investigate by hand.

The application under test is live at ${baseUrl}. You have browser tools to reproduce the failing step and observe the real current state.

## The three classifications
- product_bug: the application genuinely does not satisfy the acceptance criterion. The test is correct; the app has a defect. Provide a filer-ready issue (issue_title, issue_body with repro steps, expected, actual).
- test_rot: the application still works, but the test's locator or assumption is stale, for example a control was renamed or moved. The app is fine; the test needs updating. Provide patched_spec_code: the complete corrected spec.
- flake: the failure is non-deterministic (timing, network, animation) and does not reproduce on a clean retry. Recommend a rerun or quarantine.

## Procedure
1. Read the failing test title, the error, and the spec source you are given.
2. Reproduce the relevant step on the live app with the browser tools. Take a snapshot and see what is actually there now.
3. Compare what the test expects to what the app actually does.
   - If the intended behavior works when you drive it by hand, but the test's locator or value no longer matches what you observe, it is test_rot. Patch the spec to match the observed app.
   - If the intended behavior genuinely fails even when you drive it carefully by hand, it is product_bug. The test was right to fail.
   - If you cannot reproduce the failure at all on a careful retry, it is likely flake.
4. Call submit_triage once with your verdict and the matching artifact.

Be specific and evidence-based. Do not guess; reproduce and observe.`;
}

const MAX_TOKENS = 8192;
const MAX_TRIAGE_TURNS = 24;

// Investigates a single test failure against the live app and returns a verdict.
export async function triageFailure(
  llm: Anthropic,
  mcp: McpSession,
  failure: SpecFailure,
  specCode: string
): Promise<TriageVerdict | null> {
  const tools: Anthropic.Tool[] = [...mcp.tools, SUBMIT_TRIAGE_TOOL];
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `A regression test failed in CI.

## Failing test
${failure.title}

## Error
${failure.error}

## Spec source
\`\`\`ts
${specCode}
\`\`\`

Reproduce the relevant step on the live app, then call submit_triage with your verdict.`
    }
  ];

  for (let turn = 1; turn <= MAX_TRIAGE_TURNS; turn++) {
    if (MAX_TRIAGE_TURNS - turn === 4) {
      messages.push({
        role: "user",
        content: "A few turns remain. Conclude your investigation and call submit_triage now with your best-supported verdict."
      });
    }

    const response = await llm.messages.create({
      model: config.anthropic.model,
      max_tokens: MAX_TOKENS,
      system: triageSystemPrompt(config.sutBaseUrl),
      messages,
      tools
    });

    messages.push({ role: "assistant", content: response.content });
    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) console.log(`[triage] ${block.text.trim()}`);
    }

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );
    if (toolUses.length === 0) {
      messages.push({ role: "user", content: "Continue investigating, then call submit_triage." });
      continue;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let verdict: TriageVerdict | null = null;

    for (const toolUse of toolUses) {
      const args = (toolUse.input ?? {}) as Record<string, unknown>;
      if (toolUse.name === SUBMIT_TRIAGE_TOOL.name) {
        verdict = args as unknown as TriageVerdict;
        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: "Verdict received." });
        continue;
      }
      console.log(`[tool] ${toolUse.name} ${summarize(args)}`);
      let resultText: string;
      try {
        resultText = await mcp.callTool(toolUse.name, args);
      } catch (error) {
        resultText = `Tool error: ${error instanceof Error ? error.message : String(error)}`;
      }
      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: resultText });
    }

    messages.push({ role: "user", content: toolResults });
    if (verdict) return verdict;
  }

  return null;
}

function summarize(args: Record<string, unknown>): string {
  const text = JSON.stringify(args);
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}
