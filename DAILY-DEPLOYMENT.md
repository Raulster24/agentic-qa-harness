# Agentic QA for daily deployment

This document answers one question: how do you set up agentic QA so a team can deploy daily instead of every fifteen days?

## Where the fifteen days actually go

A regression cycle does not take three to four days because the tests run slowly. A full Playwright suite executes in minutes. It takes days because of the work around the tests, and that work is done by people:

1. Someone writes new tests when a feature ships.
2. Someone runs the suite and waits.
3. Someone triages every failure: is this a real bug, a test that broke because the UI changed, or a flake?
4. Someone repairs the tests that broke for the wrong reason.

Steps 1, 3, and 4 are the bottleneck. They are skilled, repetitive, and they do not parallelise across people easily. That is why the cadence is fifteen days, not one.

## The principle: agents do the human work, CI does the running

The design rule is simple and load-bearing: **no language model runs during the regression suite.** Agents work at authoring and maintenance time and produce ordinary, deterministic Playwright specs. CI runs those specs with no agent involved.

This matters for an enterprise client for two reasons. First, determinism: the gate that decides whether you deploy is plain code, sharded across runners, fast and repeatable, with zero token cost per run. Second, auditability: every agent action is a reviewable artifact (a proposed spec, a coverage map, a patch), and a human approves it before it can gate a deploy.

```
 feature/story ─▶ authoring agent ─▶ critic ─▶ verify & self-heal ─▶ tests/proposed
                  (Playwright MCP)                                         │
                                                            human review (the gate)
                                                                          │
 CI deploy gate ◀── tests/approved ◀──────────────────────────────────────┘
 (sharded Playwright,
  no LLM, minutes)
```

## What each agent removes from the critical path

| Human task today | Agent that removes it | What ships |
| --- | --- | --- |
| Write tests for a new story | Authoring agent: explores the live app via Playwright MCP, writes a spec grounded in what it observed, plus a criterion-to-test coverage map | A draft spec in `tests/proposed` |
| Review the test for quality | Critic agent: checks coverage, locator quality, test independence, negative paths | Objections sent back to the author, bounded loop |
| Triage a failed run | Triage agent: reproduces the failure on the live app, classifies product bug vs test rot vs flake | A label and evidence, not a human afternoon |
| Repair a test that rotted | Triage agent writes the corrected spec as a fix-PR candidate; the verify loop self-heals during authoring | A reviewable patch |

The human stays in exactly one place: approving what moves from `tests/proposed` into `tests/approved`. That is the gate the client asked for, and it is the only place a person is required.

## How this produces a daily cadence

- **Authoring keeps up with features.** New story in, draft spec out, same day. Coverage no longer lags behind development.
- **Triage stops being a human afternoon.** When the daily run goes red, the triage agent says which failures are real bugs and which are test rot, with a trace attached. A person confirms rather than investigates.
- **Rotted tests self-heal.** A renamed button or moved element produces a patch PR, not a blocked pipeline.
- **The gate runs in minutes, every commit.** The CI workflow ([regression-gate.yml](.github/workflows/regression-gate.yml)) shards the approved suite across runners on every pull request and every push to main. Green is the evidence a daily release needs; red blocks the merge.

The compression is not magic. It is moving authoring, triage, and repair off the human critical path and onto agents, while keeping the deploy gate deterministic and keeping a human approval at the end.

## Current state

| Piece | State |
| --- | --- |
| System under test (Ghostfolio, investment domain) | working |
| Authoring agent (story to draft spec + coverage map) | working |
| Critic agent | working |
| Verify and self-heal loop | working |
| CI deploy gate (sharded Playwright on PR and push) | working |
| Human review gate (proposed to approved) | working: US-001 5/5, US-002 4/4 |
| Triage agent (bug vs rot vs flake on CI failure) | working |
| Chat-response evals (DeepEval, second pillar) | planned |

See [README.md](README.md) for how to run it and [NOTES.md](NOTES.md) for the engineering decisions and the debugging history.
