import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import type { McpSession } from "./mcp.js";
import { SUBMIT_SPEC_TOOL } from "./prompts.js";

export interface CoverageEntry {
  criterion: string;
  tests: string[];
  notes?: string;
}

export interface SubmittedSpec {
  filename: string;
  spec_code: string;
  coverage: CoverageEntry[];
  exploration_notes?: string;
}

export interface AgentSession {
  messages: Anthropic.MessageParam[];
  say(content: string): void;
  runToSubmit(maxTurns: number): Promise<SubmittedSpec>;
}

const MAX_TOKENS = 8192;
const WRAP_UP_TURNS_LEFT = 8;

// Loop guard: agents waste turns repeating a dead action (re-navigating to a
// guessed URL that 404s, re-clicking a control that did nothing). If the same
// navigate/click/type recurs within a short window, we block it and redirect
// the agent instead of executing it again. Read-only actions (snapshot, wait)
// are exempt, since repeating those is sometimes legitimate.
const GUARDED_TOOLS = new Set(["browser_navigate", "browser_click", "browser_type", "browser_select_option"]);
const GUARD_WINDOW = 8;
const GUARD_MAX_REPEATS = 2;

function guardMessage(toolName: string, args: Record<string, unknown>): string {
  if (toolName === "browser_navigate") {
    return `Guard: you have already navigated to ${String(args.url)} several times with no progress. Do not navigate there again. If a guessed URL does not exist, go back to a known page and use a visible link or button. In many web apps, sign-in and account flows are dialogs opened from a visible button rather than separate URLs.`;
  }
  return `Guard: you have repeated the same ${toolName} action several times with no effect. Try a different control, take a fresh snapshot to re-read the page, or call submit_spec with what you have verified.`;
}

// One reusable agent: Claude with the Playwright MCP browser tools plus the
// submit_spec tool. Call runToSubmit to drive the tool loop until the agent
// hands in a spec. say() pushes follow-up instructions (critic objections, test
// failures) into the same conversation so the agent keeps its exploration context.
export function createAgentSession(llm: Anthropic, mcp: McpSession, system: string): AgentSession {
  const messages: Anthropic.MessageParam[] = [];
  const tools: Anthropic.Tool[] = [...mcp.tools, SUBMIT_SPEC_TOOL];

  function say(content: string): void {
    messages.push({ role: "user", content });
  }

  async function runToSubmit(maxTurns: number): Promise<SubmittedSpec> {
    const recentSignatures: string[] = [];

    for (let turn = 1; turn <= maxTurns; turn++) {
      if (maxTurns - turn === WRAP_UP_TURNS_LEFT) {
        say(
          `Turn budget warning: about ${WRAP_UP_TURNS_LEFT} turns remain. Stop exploring and call submit_spec now with the strongest spec you can justify. Record anything unverified in exploration_notes.`
        );
        console.log("[harness] turn budget warning injected");
      }

      const response = await llm.messages.create({
        model: config.anthropic.model,
        max_tokens: MAX_TOKENS,
        system,
        messages,
        tools
      });

      messages.push({ role: "assistant", content: response.content });

      for (const block of response.content) {
        if (block.type === "text" && block.text.trim()) {
          console.log(`\n[agent] ${block.text.trim()}`);
        }
      }

      const toolUses = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (toolUses.length === 0) {
        say("Continue. Explore via the browser tools, then call submit_spec exactly once when confident.");
        continue;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      let submitted: SubmittedSpec | null = null;

      for (const toolUse of toolUses) {
        const args = (toolUse.input ?? {}) as Record<string, unknown>;

        if (toolUse.name === SUBMIT_SPEC_TOOL.name) {
          submitted = args as unknown as SubmittedSpec;
          toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: "Spec received." });
          continue;
        }

        const signature = `${toolUse.name}:${JSON.stringify(args)}`;
        if (GUARDED_TOOLS.has(toolUse.name)) {
          const repeats = recentSignatures.filter((entry) => entry === signature).length;
          if (repeats >= GUARD_MAX_REPEATS) {
            console.log(`[guard] blocked repeated ${toolUse.name} ${summarize(args)}`);
            toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: guardMessage(toolUse.name, args) });
            recentSignatures.push(signature);
            if (recentSignatures.length > GUARD_WINDOW) recentSignatures.shift();
            continue;
          }
        }
        recentSignatures.push(signature);
        if (recentSignatures.length > GUARD_WINDOW) recentSignatures.shift();

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
      pruneOldBrowserOutput(messages);

      if (submitted) return submitted;
    }

    throw new Error(`Agent did not submit a spec within ${maxTurns} turns.`);
  }

  return { messages, say, runToSubmit };
}

export function writeProposedSpec(storyPath: string, spec: SubmittedSpec): string {
  const proposedDir = path.join("tests", "proposed");
  mkdirSync(proposedDir, { recursive: true });
  const specPath = path.join(proposedDir, spec.filename);
  writeFileSync(specPath, spec.spec_code);
  writeFileSync(specPath.replace(/\.spec\.ts$/, ".coverage.md"), renderCoverage(storyPath, spec));
  return specPath;
}

function summarize(args: Record<string, unknown>): string {
  const text = JSON.stringify(args);
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

// Keep the most recent tool-result turns intact; stub older large ones so the
// conversation does not grow unbounded with stale accessibility snapshots. The
// agent's own text is never pruned, so anything it wrote down survives.
function pruneOldBrowserOutput(messages: Anthropic.MessageParam[]): void {
  const resultTurnIndexes = messages
    .map((message, index) => (isToolResultTurn(message) ? index : -1))
    .filter((index) => index >= 0);
  const keep = new Set(resultTurnIndexes.slice(-3));

  for (const index of resultTurnIndexes) {
    if (keep.has(index)) continue;
    const message = messages[index];
    if (!Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (block.type === "tool_result" && typeof block.content === "string" && block.content.length > 1000) {
        block.content = "[older browser output pruned to save context; take a fresh snapshot if needed]";
      }
    }
  }
}

function isToolResultTurn(message: Anthropic.MessageParam): boolean {
  return (
    message.role === "user" &&
    Array.isArray(message.content) &&
    message.content.some((block) => block.type === "tool_result")
  );
}

function renderCoverage(storyPath: string, spec: SubmittedSpec): string {
  const rows = spec.coverage
    .map((entry) => `| ${entry.criterion} | ${entry.tests.join("<br>")} | ${entry.notes ?? ""} |`)
    .join("\n");

  return `# Coverage map: ${spec.filename}

Source story: ${storyPath}
Generated by: authoring agent (pending human review)

| Acceptance criterion | Covering tests | Notes |
| --- | --- | --- |
${rows}

## Exploration notes

${spec.exploration_notes ?? "(none)"}
`;
}
