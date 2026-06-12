# US-101: Sign in and add a product to the cart (Sauce Demo)

**As a** shopper
**I want** to sign in and add an item to my cart
**So that** I can begin a purchase

## Context

- Application under test: Sauce Demo, an e-commerce sample store, served at the configured base URL.
- The base URL shows a login page. The page itself lists the accepted test accounts.
- Test credentials (shown on the login page): username `standard_user`, password `secret_sauce`.
- A locked-out account also exists: username `locked_out_user`, password `secret_sauce`.

## Acceptance criteria

1. The login page is displayed at the base URL, with username and password fields and a login control.
2. Signing in with `standard_user` / `secret_sauce` reaches the products page, which lists products for sale.
3. Adding a product to the cart updates the cart indicator to show one item.
4. Signing in with `locked_out_user` / `secret_sauce` shows an error message and does not reach the products page.

## Out of scope

- Completing checkout and payment.
- Sorting or filtering the product list.
