import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

export interface McpSession {
  tools: Anthropic.Tool[];
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}

// Accessibility snapshots are large; cap each tool result so a single page
// cannot blow the context window. Dialogs and overlays render at the END of the
// accessibility tree, so we keep both the head and the tail and elide the
// middle, otherwise a modal on a long page would be invisible to the agent.
const MAX_TOOL_RESULT_CHARS = 24_000;

function clampToolResult(text: string): string {
  if (text.length <= MAX_TOOL_RESULT_CHARS) return text;
  const headLen = Math.floor(MAX_TOOL_RESULT_CHARS * 0.7);
  const tailLen = MAX_TOOL_RESULT_CHARS - headLen;
  const elided = text.length - MAX_TOOL_RESULT_CHARS;
  return `${text.slice(0, headLen)}\n[... ${elided} characters of middle content elided; the tail below is preserved so dialogs and overlays that render last stay visible ...]\n${text.slice(-tailLen)}`;
}

export async function startPlaywrightMcp(): Promise<McpSession> {
  const args = ["@playwright/mcp", "--isolated"];
  if (config.headless) args.push("--headless");

  const transport = new StdioClientTransport({ command: "npx", args });
  const client = new Client({ name: "agentic-qa-harness", version: "0.1.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  const anthropicTools: Anthropic.Tool[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    input_schema: (tool.inputSchema as Anthropic.Tool.InputSchema) ?? { type: "object", properties: {} }
  }));

  return {
    tools: anthropicTools,
    async callTool(name, toolArgs) {
      const result = await client.callTool({ name, arguments: toolArgs });
      const content = (result.content ?? []) as Array<{ type: string; text?: string }>;
      const text = content
        .map((item) => (item.type === "text" ? (item.text ?? "") : `[${item.type} content omitted]`))
        .join("\n");
      return clampToolResult(text) || "(no output)";
    },
    async close() {
      await client.close();
    }
  };
}
