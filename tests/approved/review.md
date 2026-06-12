# Approved suite

These specs are the trusted suite the CI deploy gate runs. Each was authored by
the agent pipeline, reviewed by the critic, executed against the live app, and
then promoted here by a human. The drafts they came from live in `tests/proposed`.

| Spec | Story | How it got here | Result |
| --- | --- | --- | --- |
| `us-001-account-creation.spec.ts` | US-001: account creation and security-token sign-in | Pipeline: author, critic (2 rounds of objections, including a caught sign-out bug), verify | 5/5 |
| `us-002-switch-language.spec.ts` | US-002: switch the interface language | Pipeline, cold (no application map): author, critic approved first round, verify | 4/4 |

## Why US-002 matters

US-002 was run with no application map in the story, so the agent discovered the
language control by exploration alone. It still produced a clean, passing,
reviewable spec. That is the evidence the pipeline is a general framework, not a
script tuned for one flow.

## The gate

Promotion from `tests/proposed` to here is the human review step. Agents never
write to this directory directly. The CI workflow runs only what is here.
