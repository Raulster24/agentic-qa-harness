import type Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

export interface Critique {
  approved: boolean;
  objections: string[];
}

const REPORT_CRITIQUE_TOOL: Anthropic.Tool = {
  name: "report_critique",
  description: "Report the review verdict on the proposed spec. Call exactly once.",
  input_schema: {
    type: "object",
    properties: {
      approved: {
        type: "boolean",
        description: "true only if the spec has no blocking issues and is ready for execution"
      },
      objections: {
        type: "array",
        items: { type: "string" },
        description: "Specific, actionable problems to fix. Empty when approved."
      }
    },
    required: ["approved", "objections"]
  }
};

const CRITIC_SYSTEM = `You are a senior QA reviewer. Review a proposed Playwright spec against the user story and these rules:
- Every acceptance criterion is covered by at least one test.
- Role-based locators (getByRole / getByLabel). Flag CSS or XPath used without a justifying comment.
- Web-first assertions. Flag any page.waitForTimeout or arbitrary sleeps.
- Tests are independent and create the state they need.
- Negative-path tests assert the right invariant (for example: access is denied), not just that some text exists.
- No placeholders, TODOs, or selectors that look guessed rather than observed.

Be specific and actionable: name the locator or line and what to change. Approve only when there are no blocking issues. Call report_critique exactly once.`;

// A second model call, separate from the author, that reviews the draft spec for
// quality and coverage before it is ever executed (the generator / critic loop).
export async function critiqueSpec(llm: Anthropic, story: string, specCode: string): Promise<Critique> {
  const response = await llm.messages.create({
    model: config.anthropic.model,
    max_tokens: 2048,
    system: CRITIC_SYSTEM,
    tools: [REPORT_CRITIQUE_TOOL],
    tool_choice: { type: "tool", name: "report_critique" },
    messages: [
      {
        role: "user",
        content: `User story:\n\n${story}\n\nProposed spec:\n\n\`\`\`ts\n${specCode}\n\`\`\``
      }
    ]
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) return { approved: true, objections: [] };
  return toolUse.input as unknown as Critique;
}
