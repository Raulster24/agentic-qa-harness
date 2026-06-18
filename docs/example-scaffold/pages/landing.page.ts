import { type Page, type Locator } from '@playwright/test';
import { AppHeader } from '../components/app-header.component.js';
import { LanguageSwitcher } from '../components/language-switcher.component.js';

/**
 * Landing page (/ → /en/start).
 *
 * Thin page object: it exposes locators and atomic actions only. Assertions live
 * in the test, so the page object stays reusable and the journey stays readable.
 * Composes the shared header and language-switcher component objects.
 */
export class LandingPage {
  readonly header: AppHeader;
  readonly language: LanguageSwitcher;
  readonly heading: Locator;

  constructor(private readonly page: Page) {
    this.header = new AppHeader(page);
    this.language = new LanguageSwitcher(page);
    // Default-locale (English) hero heading; used as the "page is ready" anchor.
    this.heading = page.getByRole('heading', { name: 'Manage your wealth like a boss' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.waitForReady();
  }

  /**
   * Angular SPA: the a11y tree right after navigation can be empty. Wait for a
   * known landing element before the test asserts anything. (Observed in US-002.)
   */
  async waitForReady(): Promise<void> {
    await this.heading.waitFor({ state: 'visible' });
  }
}
</content>
