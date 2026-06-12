# US-001: Create an account and access the portfolio with a security token

**As a** prospective Ghostfolio user
**I want** to create an account from the landing page and authenticate with my security token
**So that** I can access my portfolio overview securely

## Context

- Application under test: Ghostfolio, served at the configured base URL
- Ghostfolio issues a one-time security token at account creation instead of a password

## Acceptance criteria

1. From the landing page, a visitor can start the account creation flow.
2. Completing account creation presents the user with a security token.
3. After confirming the token was saved, the user lands on the authenticated home / overview page.
4. A signed-out user can sign back in using that security token and reach the home page again.
5. Signing in with an invalid security token shows an error and does not grant access.

## Out of scope

- Adding holdings or transactions
- Social login (Google OAuth)
