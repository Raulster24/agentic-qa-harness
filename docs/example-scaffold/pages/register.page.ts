import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Register page (/en/register) + the multi-step "Create Account" dialog.
 *
 * This page object earns its keep by encoding a real, non-obvious UI quirk the
 * agent discovered, so no journey has to rediscover it:
 *   the final "Create Account" confirm button stays DISABLED until
 *   "Copy to clipboard" is clicked.
 *
 * `createAccount()` returns the generated security token so the test can use it.
 */
export class RegisterPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Create Account' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/en/register');
  }

  /**
   * Drives the full create-account flow and returns the security token.
   * Leaves the browser on the authenticated overview page (/en/home).
   */
  async createAccount(): Promise<string> {
    await this.page.getByRole('button', { name: 'Create Account' }).click();
    await expect(this.dialog).toBeVisible();

    // Step 1 — accept the terms checkbox, continue.
    await this.dialog
      .getByRole('checkbox', {
        name: 'I understand that if I lose my security token, I cannot recover my account.'
      })
      .check();
    await this.dialog.getByRole('button', { name: 'Continue' }).click();

    // Step 2 — the token is the VALUE of a real textbox.
    const tokenField = this.dialog.getByRole('textbox', { name: 'Security Token' });
    const token = await tokenField.inputValue();

    // The quirk: confirm is disabled until the token is copied.
    const confirm = this.dialog.getByRole('button', { name: 'Create Account' });
    await expect(confirm).toBeDisabled();
    await this.dialog.getByRole('button', { name: 'Copy to clipboard' }).click();
    await expect(confirm).toBeEnabled();
    await confirm.click();

    return token;
  }
}
</content>
