import { type Page, type Locator, expect } from '@playwright/test';

/**
 * App header (role=banner) — a design-system component reused on every screen,
 * so it is a component object, not duplicated in each page object.
 *
 * Encodes the sign-in dialog flow and the account menu. Note the documented
 * fallback for the account button (see the testability report in app-model.md).
 */
export class AppHeader {
  readonly signInButton: Locator;

  constructor(private readonly page: Page) {
    this.signInButton = page.getByRole('banner').getByRole('button', { name: 'Sign in' });
  }

  async signInWithToken(token: string): Promise<void> {
    await this.signInButton.click();
    const dialog = this.page.getByRole('dialog', { name: 'Sign in' });
    await dialog.getByRole('textbox', { name: 'Security Token' }).fill(token);
    await dialog.getByRole('button', { name: 'Sign in' }).click();
  }

  /**
   * Open the account menu and log out.
   *
   * FALLBACK LOCATOR: the account/avatar button is icon-only with no accessible
   * name (filed as a High testability issue — add aria-label="Account"). Until
   * fixed, it is the trailing button in the banner. We assert the menu opened
   * correctly before clicking "Log out" so a layout change fails loudly rather
   * than silently clicking the wrong control.
   */
  async logOut(): Promise<void> {
    await this.page.getByRole('banner').getByRole('button').last().click();
    await expect(this.page.getByRole('menuitem', { name: 'My Ghostfolio' })).toBeVisible();
    await this.page.getByRole('menuitem', { name: 'Log out' }).click();
  }
}
</content>
