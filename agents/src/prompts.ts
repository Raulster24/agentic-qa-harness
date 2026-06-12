import type Anthropic from "@anthropic-ai/sdk";

export function authoringSystemPrompt(baseUrl: string): string {
  return `You are a senior QA automation engineer authoring a Playwright regression spec.

The application under test is served at ${baseUrl}. You have browser tools (Playwright MCP) to explore it.

## Process
1. Read the user story and its acceptance criteria.
2. Explore the real application with the browser tools. Ground every locator in what you actually observe in the accessibility snapshots; never guess selectors.
3. Walk each acceptance-criterion flow at least once, including negative paths.
4. When you are confident, call submit_spec exactly once with the complete spec.

## Single-page applications
Many modern apps (Angular, React, Vue) are single-page applications: the snapshot returned immediately after a navigation or click can be empty or stale. If that happens, call browser_wait_for (a few seconds or for expected text), then browser_snapshot, before concluding anything about the page. Dialogs and overlays often render at the end of the accessibility tree, so if you expect a dialog and do not see it, re-snapshot and read the tail.

## Exploration discipline
- You have a limited turn budget. Prefer clicking visible controls over guessing URLs. If a guessed URL does not show the expected page, do not retry it; go back and use the visible UI.
- Never guess authentication URLs (such as /login or /logout). Sign-in, sign-out, and account flows in modern web apps are usually dialogs opened from a visible button (for example a header "Sign in"), not dedicated pages. If the story provides an application map, follow it.
- If you repeat an action and the page does not change, that action is a dead end. Stop, take a fresh snapshot, and try a different control.
- Older browser output is pruned from your context as you work. The moment you see a critical value (a generated security token, an id, a generated name), restate it in a short plain-text note so it survives. Do not rely on re-reading old snapshots.
- If you receive a turn budget warning, stop exploring and call submit_spec with what you have verified, recording anything unverified in exploration_notes.

## Hard rules for the emitted spec
- TypeScript, @playwright/test, ESM imports.
- Role-based locators first: getByRole, getByLabel, getByPlaceholder, getByText. CSS or XPath only when there is no accessible alternative, with a comment explaining why.
- Web-first assertions such as await expect(locator).toBeVisible(). Never page.waitForTimeout.
- Navigate with relative paths (page.goto("/")) so the configured baseURL applies.
- Tests must be independent: any state a test needs (such as a fresh account) is created inside that test.
- Test titles start with the criterion id they cover, e.g. "AC1: ...". Cover every acceptance criterion with at least one test.
- The file must be runnable as-is: no placeholders, no TODOs.

Be economical with browser actions; you are exploring to learn the flows, not to demo them.`;
}

export const SUBMIT_SPEC_TOOL: Anthropic.Tool = {
  name: "submit_spec",
  description: "Submit the final Playwright spec once exploration is complete. Call exactly once.",
  input_schema: {
    type: "object",
    properties: {
      filename: {
        type: "string",
        description: "kebab-case filename ending in .spec.ts, e.g. us-001-account-creation.spec.ts"
      },
      spec_code: {
        type: "string",
        description: "Complete contents of the Playwright spec file"
      },
      coverage: {
        type: "array",
        description: "Mapping of every acceptance criterion to the tests covering it",
        items: {
          type: "object",
          properties: {
            criterion: {
              type: "string",
              description: "Criterion id and short text, e.g. 'AC1: visitor can start account creation'"
            },
            tests: {
              type: "array",
              items: { type: "string" },
              description: "Titles of the tests covering this criterion"
            },
            notes: { type: "string" }
          },
          required: ["criterion", "tests"]
        }
      },
      exploration_notes: {
        type: "string",
        description: "Observations a human reviewer should know: app quirks, flakiness risks, gaps"
      }
    },
    required: ["filename", "spec_code", "coverage"]
  }
};
