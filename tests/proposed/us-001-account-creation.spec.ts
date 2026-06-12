import { test, expect, type Page } from '@playwright/test';

/**
 * US-001: Create an account and access the portfolio with a security token.
 *
 * Ghostfolio issues a one-time security token at account creation instead of
 * a password. These tests exercise the full register / sign-out / sign-in flow.
 *
 * Observed flows (grounded in the live app):
 *  - Registration: /en/register -> "Create Account" button opens a dialog with
 *    a Terms & Conditions step. Tick the "I understand" checkbox, press
 *    "Continue", and the generated security token is shown in a "Security Token"
 *    textbox. The dialog's "Create Account" button is disabled until the token
 *    is acknowledged via the "Copy to clipboard" button. Pressing it then
 *    "Create Account" lands the user on /en/home ("Welcome to Ghostfolio").
 *  - Sign in: the header "Sign in" button opens a dialog with a "Security Token"
 *    textbox and a "Sign in" button (disabled until a value is entered).
 *  - Invalid token shows a dialog: "Oops! Incorrect Security Token." with a
 *    "Close" button; the user stays signed out on /en/start.
 *  - Sign out: the avatar/account menu button in the header reveals "Log out".
 */

/**
 * Creates a fresh account and returns the generated security token.
 * Leaves the browser on the authenticated /en/home page.
 */
async function createAccount(page: Page): Promise<string> {
  await page.goto('/en/register');

  // Opens the account creation dialog (Terms & Conditions step).
  await page.getByRole('button', { name: 'Create Account' }).click();

  // Accept the terms. The checkbox is the only checkbox in the dialog.
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue' }).click();

  // The generated security token is rendered in the "Security Token" textbox.
  const tokenField = page.getByRole('textbox', { name: 'Security Token' });
  await expect(tokenField).toBeVisible();
  const token = await tokenField.inputValue();
  expect(token).not.toBe('');

  // The dialog "Create Account" button stays disabled until the token has been
  // acknowledged via "Copy to clipboard".
  await page.getByRole('button', { name: 'Copy to clipboard' }).click();

  const confirmButton = page.getByRole('button', { name: 'Create Account' });
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  // Lands on the authenticated overview page.
  await expect(page).toHaveURL(/\/en\/home/);
  await expect(
    page.getByRole('heading', { name: 'Welcome to Ghostfolio' })
  ).toBeVisible();

  return token;
}

async function signOut(page: Page): Promise<void> {
  // The avatar/account menu is the last button in the header.
  await page.locator('header button').last().click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  // Back on the public landing page.
  await expect(page).toHaveURL(/\/en\/start/);
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
}

test.describe('US-001: Create an account and access the portfolio with a security token', () => {
  test('AC1: visitor can start the account creation flow from the register page', async ({
    page
  }) => {
    await page.goto('/en/register');

    const createAccountButton = page.getByRole('button', {
      name: 'Create Account'
    });
    await expect(createAccountButton).toBeVisible();
    await createAccountButton.click();

    // The creation dialog opens on the Terms & Conditions step.
    await expect(page.getByRole('checkbox')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  });

  test('AC2: completing account creation presents the user with a security token', async ({
    page
  }) => {
    await page.goto('/en/register');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Continue' }).click();

    const tokenField = page.getByRole('textbox', { name: 'Security Token' });
    await expect(tokenField).toBeVisible();
    await expect(tokenField).not.toHaveValue('');
  });

  test('AC3: after confirming the token, the user lands on the authenticated overview page', async ({
    page
  }) => {
    await createAccount(page);

    // createAccount already asserts /en/home + welcome heading; assert the
    // authenticated navigation as additional confidence.
    await expect(page).toHaveURL(/\/en\/home/);
    await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Portfolio' })).toBeVisible();
  });

  test('AC4: a signed-out user can sign back in with the security token and reach the home page', async ({
    page
  }) => {
    const token = await createAccount(page);
    await signOut(page);

    // Open the sign-in dialog from the header.
    await page.getByRole('button', { name: 'Sign in' }).click();

    const tokenInput = page.getByRole('textbox', { name: 'Security Token' });
    await expect(tokenInput).toBeVisible();
    await tokenInput.fill(token);

    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toBeEnabled();
    await signInButton.click();

    // Back on the authenticated overview page.
    await expect(page).toHaveURL(/\/en\/home/);
    await expect(
      page.getByRole('heading', { name: 'Welcome to Ghostfolio' })
    ).toBeVisible();
  });

  test('AC5: signing in with an invalid security token shows an error and does not grant access', async ({
    page
  }) => {
    // A valid account is not required to verify the invalid-token path, but we
    // start from the landing page where the "Sign in" button lives.
    await page.goto('/en/start');

    await page.getByRole('button', { name: 'Sign in' }).click();

    const tokenInput = page.getByRole('textbox', { name: 'Security Token' });
    await expect(tokenInput).toBeVisible();
    await tokenInput.fill('invalidtoken1234567890');

    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toBeEnabled();
    await signInButton.click();

    // Error dialog appears and access is not granted.
    await expect(
      page.getByText('Oops! Incorrect Security Token.')
    ).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();

    // Still signed out on the public landing page.
    await expect(page).toHaveURL(/\/en\/start/);
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});
