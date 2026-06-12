# agentic-qa-harness

Agent-authored, human-gated Playwright regression testing. LLM agents author, triage, and maintain the test suite; CI runs plain, deterministic Playwright specs.

## The problem this addresses

A regression cycle that takes 3 to 4 days does not take that long because the tests execute slowly. It takes that long because humans author tests, triage failures, and repair tests that rotted when the UI changed. This harness moves that work to agents while keeping two properties that matter in an enterprise setting:

1. **Determinism in the hot path.** No LLM runs during the regression suite itself. Agents produce and maintain ordinary Playwright specs; the suite runs in minutes, sharded in CI, at zero token cost.
2. **A human gate with an audit trail.** Agents never commit directly to the suite. Every agent action lands as a reviewable artifact (proposed spec, coverage map, patch) that a human approves.

## Architecture

```
stories/*.md ──▶ authoring agent ──▶ tests/proposed/ ──▶ human review ──▶ tests/approved/ ──▶ CI
                 (Azure OpenAI                                                              (plain Playwright,
                  + Playwright MCP)                                                          no LLM involved)
```

- **Authoring agent** (`agents/src/authoring-agent.ts`): takes a user story with acceptance criteria, explores the live application through the official Playwright MCP server, grounding every locator in observed accessibility snapshots, then emits a deterministic spec plus a criterion-to-test coverage map into `tests/proposed/`.
- **System under test**: [Ghostfolio](https://github.com/ghostfolio/ghostfolio), an open source wealth management application (portfolio dashboard, holdings, allocations), run locally via Docker.
- **Model layer**: chat completions with tool calling, Azure OpenAI or plain OpenAI selected purely by configuration. The endpoint, deployment, and API version are environment variables, not code.

## Quickstart

```bash
# 1. Start the system under test (Ghostfolio + Postgres + Redis)
npm run sut:up          # serves http://localhost:3333

# 2. Install dependencies and the browser
npm install
npx playwright install chromium

# 3. Configure the model provider (Azure OpenAI or plain OpenAI)
cp .env.example .env    # fill in one provider block

# 4. Verify the browser/MCP path without spending tokens
npm run smoke

# 5. Let the agent author a spec from a user story
npm run author -- stories/US-001-account-creation.md

# 6. Review the proposed spec and coverage map, then run it
npm run test:proposed
```

Set `HEADLESS=0` in `.env` to watch the agent drive the browser.

## Status

| Component | State |
| --- | --- |
| SUT (Ghostfolio via docker compose) | working |
| Authoring agent (story to proposed spec, with coverage map) | working |
| Human review gate (draft in proposed, verified + corrected into approved) | working: US-001, 4/4 passing |
| Critic agent (reviews generated specs against quality rules before proposal) | planned |
| HITL gate automation (promotion via PR + CODEOWNERS) | planned |
| Triage agent (classifies CI failures: product bug vs test rot vs flake; self-heals rot via patch PR) | planned |
| Chat response evals (DeepEval; golden set, faithfulness, semantic comparison) | planned |
| CI pipeline (GitHub Actions: sharded regression on PR, eval gate) | planned |

## Spec quality rules enforced on the agent

- Role-based locators (`getByRole`, `getByLabel`); CSS or XPath only with a justifying comment
- Web-first assertions; `page.waitForTimeout` is banned
- Tests are independent; any state a test needs is created inside that test
- Every acceptance criterion maps to at least one test, and the mapping ships with the spec
