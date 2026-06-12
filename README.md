# agentic-qa-harness

Agent-authored, human-gated Playwright regression testing. LLM agents author, triage, and maintain the test suite; CI runs plain, deterministic Playwright specs.

## The problem this addresses

A regression cycle that takes 3 to 4 days does not take that long because the tests execute slowly. It takes that long because humans author tests, triage failures, and repair tests that rotted when the UI changed. This harness moves that work to agents while keeping two properties that matter in an enterprise setting:

1. **Determinism in the hot path.** No LLM runs during the regression suite itself. Agents produce and maintain ordinary Playwright specs; the suite runs in minutes, sharded in CI, at zero token cost.
2. **A human gate with an audit trail.** Agents never commit directly to the suite. Every agent action lands as a reviewable artifact (proposed spec, coverage map, patch) that a human approves.

## Architecture

```
stories/*.md ─▶ author ─▶ critic ─▶ verify & self-heal ─▶ tests/proposed/ ─▶ human review ─▶ tests/approved/ ─▶ CI
                (Claude + Playwright MCP)                                                          (plain Playwright,
                                                                                                    no LLM involved)

CI failure ─▶ triage agent ─▶ product bug (issue) | test rot (patch PR) | flake (rerun)
```

- **Authoring agent** (`agents/src/authoring-agent.ts`): takes a user story with acceptance criteria, explores the live application through the official Playwright MCP server, grounding every locator in observed accessibility snapshots, then emits a deterministic spec plus a criterion-to-test coverage map into `tests/proposed/`.
- **Critic agent** (`agents/src/critic.ts`): a second model reviews the draft against quality rules and coverage before it is executed.
- **Verify and self-heal** (`agents/src/pipeline.ts`): runs the draft against the live app and feeds any failure back so the agent fixes its own runtime mistakes.
- **Triage agent** (`agents/src/triage.ts`): on a failure, reproduces the step on the live app and classifies it as product bug, test rot, or flake, then writes the matching artifact (issue draft or patched spec).
- **System under test**: [Ghostfolio](https://github.com/ghostfolio/ghostfolio), an open source wealth management application (portfolio dashboard, holdings, allocations), run locally via Docker.
- **Model layer**: the official Anthropic SDK with a manual agentic tool-use loop. The model is an environment variable (`ANTHROPIC_MODEL`), not code.

## Quickstart

```bash
# 1. Start the system under test (Ghostfolio + Postgres + Redis)
npm run sut:up          # serves http://localhost:3333

# 2. Install dependencies and the browser
npm install
npx playwright install chromium

# 3. Configure the model (Anthropic API key)
cp .env.example .env    # fill in ANTHROPIC_API_KEY

# 4. Verify the key and the browser/MCP path
npm run smoke:llm       # cheap key + model check
npm run smoke           # browser/MCP check (no tokens)

# 5. Run the full pipeline: author, critic, verify, self-heal
npm run pipeline -- stories/US-001-account-creation.md

# 6. Review the proposed spec, then promote it to tests/approved by hand (the gate)

# 7. Triage a failing spec (classify bug vs rot vs flake, write the fix/issue)
npm run triage -- tests/proposed/<some>.spec.ts
```

Set `HEADLESS=0` in `.env` to watch the agent drive the browser. Set `ANTHROPIC_MODEL=claude-sonnet-4-6` for a faster, lower-cost run.

## Status

| Component | State |
| --- | --- |
| SUT (Ghostfolio via docker compose) | working |
| Authoring agent (story to proposed spec, with coverage map) | working |
| Critic agent (reviews drafts against quality rules before execution) | working |
| Verify and self-heal loop (runs the draft, feeds failures back) | working |
| Human review gate (proposed to approved) | working: US-001 5/5, US-002 4/4 |
| CI deploy gate (sharded Playwright on PR and push) | working |
| Triage agent (product bug vs test rot vs flake; writes issue or patch) | working |
| HITL gate automation (promotion via PR + CODEOWNERS) | planned |
| Chat response evals (DeepEval; golden set, faithfulness, semantic comparison) | planned |

## Spec quality rules enforced on the agent

- Role-based locators (`getByRole`, `getByLabel`); CSS or XPath only with a justifying comment
- Web-first assertions; `page.waitForTimeout` is banned
- Tests are independent; any state a test needs is created inside that test
- Every acceptance criterion maps to at least one test, and the mapping ships with the spec
