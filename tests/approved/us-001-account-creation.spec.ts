import { test, expect, type Page } from '@playwright/test';

/**
 * US-001: Create an account and access the portfolio with a security token
 *
 * Ghostfolio is a single-page app. The base URL redirects to /en/start (landing).
 *
 * Everything below is grounded in the live accessibility tree observed during
 * exploration:
 *
 * Account creation (/en/register):
 *   - A "Create Account" button opens a dialog (role=dialog, name "Create Account").
 *   - Step 1 (tab "Terms and Conditions"): a single checkbox named
 *       "I understand that if I lose my security token, I cannot recover my account."
 *     enables the "Continue" button once checked.
 *   - Step 2 (tab "Security Token"): a one-time token is rendered as the VALUE
 *     of a real input, role=textbox, name "Security Token" (confirmed in the
 *     a11y tree as `textbox "Security Token": <128-hex-chars>`), so
 *     inputValue() returns the token. The final, dialog-scoped "Create Account"
 *     button is DISABLED until "Copy to clipboard" is clicked.
 *   - Confirming navigates to /en/home (Overview) with a
 *     "Welcome to Ghostfolio" heading for a fresh, empty account.
 *
 * Sign in:
 *   - The header "Sign in" button (inside the banner, only present when signed
 *     out) opens a dialog (role=dialog, name "Sign in") with a "Security Token"
 *     textbox and a "Sign in" submit button that enables once a token is typed.
 *
 * Sign out / account menu (authenticated only):
 *   - The account/avatar control is an icon-only button with NO accessible
 *     name. In the observed authenticated banner it is the LAST button; on
 *     activation it gains aria-expanded and opens a menu containing the
 *     menuitems "My Ghostfolio" and "Log out". signOut() asserts the
 *     "My Ghostfolio" menuitem is visible to confirm the correct control was
 *     opened before clicking "Log out".
 *
 * Invalid sign in:
 *   - Shows a dialog named "Oops! Incorrect Security Token." with a "Close"
 *     button; the user stays on /en/start, unauthenticated. Verified that
 *     navigating to /en/home while signed out redirects back to /en/start.
 *
 * Account creation requires clicking "Copy to clipboard", which needs clipboard
 * permissions, granted via test.use() below.
 */

// Account creation requires clicking "Copy to clipboard" to enable the final
// "Create Account" button, which needs clipboard access.
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

/**
 * Registers a brand new account and returns the generated security token.
 * Leaves the browser on the authenticated /en/home page.
 */
async function createAccount(page: Page): Promise<string> {
  await page.goto('/en/register');

  // Open the account-creation dialog (the page's own "Create Account" button).
  await page.getByRole('button', { name: 'Create Account' }).click();

  const dialog = page.getByRole('dialog', { name: 'Create Account' });
  await expect(dialog).toBeVisible();

  // Step 1: accept the terms checkbox, then continue.
  await dialog
    .getByRole('checkbox', {
      name: 'I understand that if I lose my security token, I cannot recover my account.'
    })
    .check();
  await dialog.getByRole('button', { name: 'Continue' }).click();

  // Step 2: the security token is the VALUE of a real input
  // (role=textbox name "Security Token"), confirmed in the a11y tree.
  const tokenField = dialog.getByRole('textbox', { name: 'Security Token' });
  await expect(tokenField).toBeVisible();
  const token = await tokenField.inputValue();
  expect(token).not.toEqual('');

  // The final "Create Account" button is disabled until the token is copied.
  const confirmButton = dialog.getByRole('button', { name: 'Create Account' });
  await expect(confirmButton).toBeDisabled();
  await dialog.getByRole('button', { name: 'Copy to clipboard' }).click();
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  // We should land on the authenticated overview page.
  await expect(page).toHaveURL(/\/en\/home/);
  await expect(
    page.getByRole('heading', { name: 'Welcome to Ghostfolio' })
  ).toBeVisible();

  return token;
}

/**
 * Signs out via the header account menu. The account/avatar button is icon-only
 * with no accessible name; in the observed authenticated banner it is the last
 * button. We confirm the correct control was opened by asserting the
 * "My Ghostfolio" menuitem is visible before clicking "Log out".
 * Leaves the browser on the landing page.
 */
async function signOut(page: Page) {
  // No role-with-name alternative exists for the avatar button; it is the
  // trailing button in the authenticated header banner.
  await page.getByRole('banner').getByRole('button').last().click();

  // Confirm we opened the account menu (not some other control) before logging out.
  await expect(page.getByRole('menuitem', { name: 'My Ghostfolio' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Log out' }).click();

  await expect(page).toHaveURL(/\/en\/start/);
}

test.describe('US-001: Account creation and security-token authentication', () => {
  test('AC1: a visitor can start the account creation flow from the register page', async ({
    page
  }) => {
    await page.goto('/en/register');

    const createAccountButton = page.getByRole('button', {
      name: 'Create Account'
    });
    await expect(createAccountButton).toBeVisible();
    await createAccountButton.click();

    // The creation dialog opens on its first step: terms checkbox + Continue.
    const dialog = page.getByRole('dialog', { name: 'Create Account' });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('checkbox', {
        name: 'I understand that if I lose my security token, I cannot recover my account.'
      })
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Continue' })).toBeVisible();
  });

  test('AC2: completing account creation presents the user with a security token', async ({
    page
  }) => {
    await page.goto('/en/register');
    await page.getByRole('button', { name: 'Create Account' }).click();

    const dialog = page.getByRole('dialog', { name: 'Create Account' });
    await dialog
      .getByRole('checkbox', {
        name: 'I understand that if I lose my security token, I cannot recover my account.'
      })
      .check();
    await dialog.getByRole('button', { name: 'Continue' }).click();

    // Read the token from the dialog-scoped textbox. Assert we are genuinely on
    // step 2 (the disabled, dialog-scoped "Create Account" confirm button is
    // present) so the token read is unambiguously from the registration flow.
    const tokenField = dialog.getByRole('textbox', { name: 'Security Token' });
    await expect(tokenField).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Create Account' })
    ).toBeDisabled();

    const token = await tokenField.inputValue();
    expect(token.length).toBeGreaterThan(0);
  });

  test('AC3: after confirming the token was saved, the user lands on the overview page', async ({
    page
  }) => {
    // createAccount asserts navigation to /en/home and the welcome heading.
    const token = await createAccount(page);
    expect(token.length).toBeGreaterThan(0);

    await expect(page).toHaveURL(/\/en\/home/);
    await expect(
      page.getByRole('heading', { name: 'Welcome to Ghostfolio' })
    ).toBeVisible();
  });

  test('AC4: a signed-out user can sign back in with the security token and reach the home page', async ({
    page
  }) => {
    // Build fresh state: create an account to obtain a valid token.
    const token = await createAccount(page);

    // Sign out via the account menu.
    await signOut(page);

    // Back on the landing page, signed out: the header "Sign in" button shows.
    await expect(
      page.getByRole('banner').getByRole('button', { name: 'Sign in' })
    ).toBeVisible();

    // Open the Sign in dialog from the header and authenticate with the token.
    await page
      .getByRole('banner')
      .getByRole('button', { name: 'Sign in' })
      .click();

    const dialog = page.getByRole('dialog', { name: 'Sign in' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Security Token' }).fill(token);

    // The dialog's "Sign in" submit becomes enabled once a token is entered.
    const submit = dialog.getByRole('button', { name: 'Sign in' });
    await expect(submit).toBeEnabled();
    await submit.click();

    // Authenticated overview page is reached again.
    await expect(page).toHaveURL(/\/en\/home/);
    await expect(
      page.getByRole('heading', { name: 'Welcome to Ghostfolio' })
    ).toBeVisible();
  });

  test('AC5: signing in with an invalid security token shows an error and does not grant access', async ({
    page
  }) => {
    await page.goto('/en/start');

    // Open the Sign in dialog from the header (scoped to avoid colliding with
    // the dialog's own "Sign in" submit button once it is present).
    await page
      .getByRole('banner')
      .getByRole('button', { name: 'Sign in' })
      .click();

    const dialog = page.getByRole('dialog', { name: 'Sign in' });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole('textbox', { name: 'Security Token' })
      .fill('invalidtoken1234567890');

    const submit = dialog.getByRole('button', { name: 'Sign in' });
    await expect(submit).toBeEnabled();
    await submit.click();

    // An error dialog is shown and the URL never became the authenticated home.
    const errorDialog = page.getByRole('dialog', {
      name: 'Oops! Incorrect Security Token.'
    });
    await expect(errorDialog).toBeVisible();
    await expect(page).not.toHaveURL(/\/en\/home/);

    // Dismiss the error.
    await errorDialog.getByRole('button', { name: 'Close' }).click();

    // Robust proof of denied access: still signed out (header "Sign in" present),
    // and a direct attempt to reach the authenticated home redirects back to the
    // landing page (no authenticated overview is rendered).
    await expect(
      page.getByRole('banner').getByRole('button', { name: 'Sign in' })
    ).toBeVisible();

    await page.goto('/en/home');
    await expect(page).toHaveURL(/\/en\/start/);
    await expect(
      page.getByRole('heading', { name: 'Welcome to Ghostfolio' })
    ).toHaveCount(0);
    await expect(
      page.getByRole('banner').getByRole('button', { name: 'Sign in' })
    ).toBeVisible();
  });
});
