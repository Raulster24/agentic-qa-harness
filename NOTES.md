# Working notes

Decisions and findings while building this, in rough order. Not polished documentation.

## Architecture call: keep the LLM out of the hot path

A 3 to 4 day regression cycle is not slow because tests execute slowly. It is slow because humans author tests, triage failures, and repair tests after UI changes. So the agent works at authoring time and produces ordinary Playwright specs. The suite itself runs in CI with no LLM involved: deterministic, parallelisable, zero token cost per run. One authoring session per story, then the spec is free forever.

Rejected alternative: an agent that drives the browser for every regression run. Slow, expensive, and non-deterministic exactly where determinism matters most.

## Why Ghostfolio as the system under test

- Real investment domain (portfolio overview, holdings, allocations), so generated tests mean something
- Self-hostable with docker compose, no external accounts needed
- Complex enough that locator quality and SPA timing actually get exercised

Tradeoff: no source-level control, so seeding a deliberate product bug is harder. Plan for the triage demo is to pin two image versions and let real UI drift between versions stand in for app changes.

## Why Playwright MCP instead of codegen / record-and-replay

Codegen records one happy path. The agent explores: it can walk negative paths (invalid token), read the accessibility tree, and choose locators based on what is actually exposed. Every locator in the emitted spec is grounded in a snapshot the agent observed, not guessed from source.

## Locator policy

getByRole / getByLabel first, CSS or XPath only with a justifying comment. Role-based locators survive DOM and styling churn, and they fail when accessibility regresses, which is a feature, not flakiness.

## Findings along the way

- Ghostfolio's Prisma pg adapter fails hard (TlsConnectionError) on sslmode=prefer against a Postgres without TLS. Local stack now uses sslmode=disable. Cost about 20 minutes of log reading.
- Angular SPA: the accessibility snapshot taken immediately after navigation can be empty (first paint not done). The agent prompt now says to wait and re-snapshot instead of trusting the first response. Found via the token-free smoke script, which is why that script exists.
- Context budget is a real constraint in long agent sessions: tool results are capped and older browser output is pruned, keeping only the most recent results intact. Without this a 40 turn session blows the window.
- First full run died on a 429: per-minute token limits are an operational reality for agentic QA, not an edge case. Treat 429 as a pacing signal: client now retries with backoff (SDK honors retry-after) and snapshot caps were cut from 30k to 12k chars so a full turn fits well inside the budget. Lesson: size the agent's context to the account's tokens-per-minute tier, not to the model's context window.
- Second run produced nothing: the agent exhausted its turn budget. Two compounding causes. (1) Context pruning threw away the snapshot containing the generated security token, so the sign-back-in criterion became impossible and the agent wandered. Fix: prompt rule to restate critical values in its own notes immediately, because its own messages are never pruned. (2) It guessed a /signin URL that does not exist and retried the same guess about ten times instead of using the visible Sign in button. Fix: prompt rule to prefer visible controls and never retry a failed URL guess. Also added a wrap-up warning a few turns before the budget ends, so a timeboxed session always hands in a spec with caveats instead of nothing. Same principle as timeboxed exploratory testing: when time is up, you write up what you have.

## Governance shape

tests/proposed/ is agent output. tests/approved/ is what CI runs. Promotion is a human review (PR + CODEOWNERS once CI is wired). Agents never write to approved/. Every agent artifact ships with a criterion-to-test coverage map so the reviewer checks coverage, not just code.

## US-001 outcome: the review gate earned its place

The agent's draft (tests/proposed) did not pass as written. Verified the real flow against the running app and promoted a corrected spec to tests/approved (4/4 passing in ~11s). Full diff in tests/approved/review.md. The decisive miss: the token step keeps "Create Account" disabled until you click "Copy to clipboard", so the agent's registration could never complete. The agent also treated a link as a button, assumed an error toast that does not persist, and hit a strict-mode ambiguity on a duplicated "Sign in" control. None of these are exotic; all are exactly what a human reviewer is there to catch. This is the honest version of the pitch: the agent does the first eighty percent in one pass, the gate catches the rest, and the suite that ships is deterministic.

## Switched the model layer from OpenAI to the Claude API

The personal OpenAI key was capped at 30k tokens per minute, which made a full authoring run take 25 to 35 minutes (rate-limit bound, not compute bound) and produced heavy thrashing. Migrated the whole agent layer to the official Anthropic SDK with a manual agentic tool-use loop (native content blocks, not the OpenAI shape). Result on the same US-001 story: authoring went from ~35 minutes and ~150 tool calls to 1 minute 45 seconds and 15 tool calls, and the agent discovered the copy-to-clipboard gate by reasoning on the first pass rather than after multiple heal rounds. The full pipeline (author, critic, verify) self-corrected to 5/5 in about 7 minutes. Lesson: model choice was the dominant lever, more than any single code change.

## A real migration bug: snapshot truncation hid dialogs

After the switch, the agent kept failing to read the sign-in dialog. Cause was mine: the snapshot character cap truncated the tail of the page, and dialogs and overlays render at the end of the accessibility tree, so a modal on a long page was invisible. The agent actually diagnosed this itself ("the content is character-based, not viewport-based"). Fix: keep both the head and the tail of the snapshot and elide the middle, and raise the cap.

## Generic, not overfit

US-001 had an application map I had written by hand from earlier probe scripts. To test whether the framework depended on that, wrote US-002 (language switching) with no application map and ran the pipeline cold. The agent found the language control in the footer by exploration alone and produced a passing 4/4 spec, critic approved first round, in about 2.5 minutes. The map is a convenience, not a crutch.

## Triage agent: the keystone for daily deployment

The author and critic keep tests being written; triage keeps the suite from blocking a deploy. On a failure it reproduces the step on the live app and decides product bug vs test rot vs flake, then writes the matching artifact. Demonstrated on a rotted spec (a stale German tagline simulating UI text drift): triage reproduced the language switch, confirmed the app works, classified both failures as test rot with high confidence, and wrote a patched spec that passed 4/4. Ninety seconds, no human investigation. This is the part that removes the human-afternoon triage cost that keeps regression at 3 to 4 days.

## Next

1. Critic pass before proposal: second model call reviews the spec against the quality rules and acceptance-criteria coverage, bounded loop, then propose
2. Failure triage agent: replay failure via MCP, classify product bug vs test rot vs flake, patch rot via PR, file bugs with repro
3. DeepEval suite for chat surfaces (separate pillar, same proposed/approved gating)
4. GitHub Actions: sharded regression on PR, full run nightly
