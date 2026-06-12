import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { config } from "./config.js";

export interface McpSession {
  openAiTools: ChatCompletionTool[];
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}

// Accessibility snapshots are large; cap each tool result so a single page
// cannot blow the context window. Sized so a full conversation turn stays
// well inside a 30k tokens-per-minute account limit.
const MAX_TOOL_RESULT_CHARS = 12_000;

export async function startPlaywrightMcp(): Promise<McpSession> {
  const args = ["@playwright/mcp", "--isolated"];
  if (config.headless) args.push("--headless");

  const transport = new StdioClientTransport({ command: "npx", args });
  const client = new Client({ name: "agentic-qa-harness", version: "0.1.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  const openAiTools: ChatCompletionTool[] = tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: (tool.inputSchema as Record<string, unknown>) ?? { type: "object", properties: {} }
    }
  }));

  return {
    openAiTools,
    async callTool(name, toolArgs) {
      const result = await client.callTool({ name, arguments: toolArgs });
      const content = (result.content ?? []) as Array<{ type: string; text?: string }>;
      const text = content
        .map((item) => (item.type === "text" ? (item.text ?? "") : `[${item.type} content omitted]`))
        .join("\n");
      if (text.length > MAX_TOOL_RESULT_CHARS) {
        return `${text.slice(0, MAX_TOOL_RESULT_CHARS)}\n[truncated ${text.length - MAX_TOOL_RESULT_CHARS} characters]`;
      }
      return text || "(no output)";
    },
    async close() {
      await client.close();
    }
  };
}
