import { test as base, type Page } from '@playwright/test';
import { LandingPage } from './pages/landing.page.js';
import { RegisterPage } from './pages/register.page.js';
import { createSeededAccount, type SeededAccount } from './factories.js';

/**
 * Dependency injection via Playwright fixtures.
 *
 * Two kinds of injected dependency:
 *   1. Page objects — constructed once per test, so journeys never `new` them.
 *   2. `authedPage` — an already-authenticated page using SET-UP-VIA-API:
 *      the account + session are created over HTTP and the JWT is injected into
 *      localStorage, so a test that isn't about login doesn't pay to click
 *      through registration. State is set up via API; behaviour is verified via UI.
 */

interface Fixtures {
  landingPage: LandingPage;
  registerPage: RegisterPage;
  seededAccount: SeededAccount;
  authedPage: Page;
}

export const test = base.extend<Fixtures>({
  landingPage: async ({ page }, use) => {
    await use(new LandingPage(page));
  },

  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },

  // Create a fresh account over the API for this test (independent state).
  seededAccount: async ({ request }, use) => {
    await use(await createSeededAccount(request));
  },

  // A page that starts already signed in, by injecting the session token.
  authedPage: async ({ page, seededAccount }, use) => {
    // Visit once so localStorage is same-origin, then inject the session.
    await page.goto('/en/start');
    await page.evaluate((jwt) => {
      // DISCOVERED — confirm: SPA reads the session from localStorage["auth-token"].
      window.localStorage.setItem('auth-token', jwt);
    }, seededAccount.authToken);
    await page.goto('/en/home');
    await use(page);
  }
});

export { expect } from '@playwright/test';
</content>
