import { expect, test } from '@playwright/test';

/**
 * US-002: Switch the application language
 *
 * The landing page is a single-page app (Angular). After navigating, the
 * initial accessibility tree can be empty/stale, so each test waits for a
 * known piece of landing-page text before asserting.
 *
 * The language switcher is a list of language links rendered in the page
 * footer (contentinfo landmark), e.g. "English", "Deutsch". Selecting one
 * navigates the app to the corresponding locale-prefixed URL (/en, /de, ...)
 * and re-renders the interface in that language.
 */

const ENGLISH_HEADING = 'Manage your wealth like a boss';
const GERMAN_HEADING = 'Verwalte dein Vermögen wie ein Profi';

test.describe('US-002: Switch the application language', () => {
  test('AC1: the landing page is displayed in English by default', async ({
    page
  }) => {
    await page.goto('/');

    // App redirects "/" to the locale-prefixed English landing page.
    await expect(page).toHaveURL(/\/en(\/|$)/);

    // English interface text is visible.
    await expect(
      page.getByRole('heading', { name: ENGLISH_HEADING })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign in' })
    ).toBeVisible();
  });

  test('AC2: a visitor can find and use a control to change the language', async ({
    page
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: ENGLISH_HEADING })
    ).toBeVisible();

    // The language switcher lives in the footer (contentinfo landmark).
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'English' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Deutsch' })).toBeVisible();
  });

  test('AC3: selecting German changes the interface text to German', async ({
    page
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: ENGLISH_HEADING })
    ).toBeVisible();

    await page
      .getByRole('contentinfo')
      .getByRole('link', { name: 'Deutsch' })
      .click();

    // URL switches to the German locale.
    await expect(page).toHaveURL(/\/de(\/|$)/);

    // German interface text is now visible; English heading is gone.
    await expect(
      page.getByRole('heading', { name: GERMAN_HEADING })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Einloggen' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: ENGLISH_HEADING })
    ).toHaveCount(0);
  });

  test('AC4: after switching to German, the visitor can switch back to English', async ({
    page
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: ENGLISH_HEADING })
    ).toBeVisible();

    // Switch to German first.
    await page
      .getByRole('contentinfo')
      .getByRole('link', { name: 'Deutsch' })
      .click();
    await expect(page).toHaveURL(/\/de(\/|$)/);
    await expect(
      page.getByRole('heading', { name: GERMAN_HEADING })
    ).toBeVisible();

    // Now switch back to English using the footer control.
    await page
      .getByRole('contentinfo')
      .getByRole('link', { name: 'English' })
      .click();

    await expect(page).toHaveURL(/\/en(\/|$)/);
    await expect(
      page.getByRole('heading', { name: ENGLISH_HEADING })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign in' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: GERMAN_HEADING })
    ).toHaveCount(0);
  });
});
