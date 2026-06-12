# US-002: Switch the application language

**As a** visitor who prefers another language
**I want** to change the interface language from the landing page
**So that** I can read the application in a language I understand

## Context

- Application under test: Ghostfolio, served at the configured base URL.
- The application supports multiple interface languages.

## Acceptance criteria

1. The landing page is displayed in English by default.
2. A visitor can find and use a control to change the interface language.
3. Selecting German (Deutsch) changes the visible interface text to German.
4. After switching to German, the visitor can switch the interface back to English.

## Out of scope

- Creating an account or signing in.
- Translating user-generated content.
