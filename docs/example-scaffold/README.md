# Example scaffold — what the bootstrapping pipeline produces

This directory is an **illustrative example** of the artifacts the cold-start
pipeline (Surveyor → Architect → pilot → consolidation) emits on its first pass
against a new app. The target here is the demo SUT, **Ghostfolio**.

It is *not* wired into the running suite. It exists to show the **shape** of
agent-authored framework output: thin page objects, design-system component
objects, dependency-injected fixtures, data factories, and a readable journey
that composes them.

Everything here is grounded in the live accessibility tree the authoring agent
already observed for US-001 (account creation) and US-002 (language switch) —
see `tests/approved/`. So the locators are real, not guessed.

## What each file demonstrates

| File | Pipeline phase | Pattern it shows |
| --- | --- | --- |
| `app-model.md` | Phase 0 — Surveyor | The discovered application model (screens, nav, components, API surface, testability report) |
| `pages/landing.page.ts` | Phase 1 — Architect | Thin page object: locators + atomic actions, no assertions |
| `pages/register.page.ts` | Phase 1 — Architect | Page object that encodes a real UI quirk (copy-to-clipboard gate) as a method |
| `components/app-header.component.ts` | Phase 1 — Architect | Component object for a design-system widget reused across screens |
| `components/language-switcher.component.ts` | Phase 1 — Architect | Component object extracted from the footer (clustered in Phase 0) |
| `factories.ts` | Phase 1 — Architect | Test-data builders (the control plane's builder API) |
| `fixtures.ts` | Phase 1 — Architect | Dependency injection: `set-up-via-API` auth, page objects injected per test |
| `example-journey.spec.ts` | Phase 2 — Pilot | A DAMP, readable journey composing all of the above |

## The two honest annotations the Architect agent attaches

1. **Testability report** (`app-model.md`): the avatar/account button is
   icon-only with no accessible name. The agent **cannot fix this itself** — it
   files it as a request to the frontend team and meanwhile falls back to a
   positional locator with a justifying comment.

2. **API setup is discovered, not assumed**: the `set-up-via-API` auth fixture
   is built from endpoints the Surveyor observed in the network tab during the
   happy path. The exact endpoint/shape is marked `// DISCOVERED — confirm` so a
   human verifies it at the heavy one-time gate.
</content>
