import { type Page } from '@playwright/test';

/**
 * Footer language switcher (role=contentinfo) — clustered in Phase 0 as a
 * widget that appears on every public screen, so it becomes a component object.
 * One place to change if the switcher ever moves; every test heals at once.
 */
export class LanguageSwitcher {
  constructor(private readonly page: Page) {}

  /** Display name as rendered in the footer, e.g. "English", "Deutsch". */
  async switchTo(languageName: string): Promise<void> {
    await this.page
      .getByRole('contentinfo')
      .getByRole('link', { name: languageName })
      .click();
  }
}
</content>
