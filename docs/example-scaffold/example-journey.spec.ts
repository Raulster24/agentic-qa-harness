import { test, expect } from './fixtures.js';

/**
 * Pilot journey (Phase 2) — what an agent-authored test BODY looks like once the
 * foundation exists. Compare with tests/approved/us-001: the same behaviour, but
 * the journey is DAMP and readable because the page objects, components, and
 * fixtures (DRY) carry the mechanics.
 *
 * The rule: foundation is DRY, journey bodies are DAMP.
 */

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('Account & session (pilot journeys over the new scaffold)', () => {
  test('a visitor can create an account and reach the overview', async ({ registerPage, page }) => {
    await registerPage.goto();

    const token = await registerPage.createAccount();
    expect(token).not.toEqual('');

    await expect(page).toHaveURL(/\/en\/home/);
    await expect(page.getByRole('heading', { name: 'Welcome to Ghostfolio' })).toBeVisible();
  });

  test('a returning user can sign out and sign back in with their token', async ({
    registerPage,
    landingPage,
    page
  }) => {
    const token = await registerPage.createAccount();

    await landingPage.header.logOut();
    await expect(page).toHaveURL(/\/en\/start/);

    await landingPage.header.signInWithToken(token);
    await expect(page).toHaveURL(/\/en\/home/);
  });

  test('an authenticated user (seeded via API) lands on the overview directly', async ({
    authedPage
  }) => {
    // No UI login: the authedPage fixture set up the session via the API.
    // This is how non-login journeys avoid paying the registration cost.
    await expect(authedPage).toHaveURL(/\/en\/home/);
  });

  test('switching to German re-renders the landing page', async ({ landingPage, page }) => {
    await landingPage.goto();
    await landingPage.language.switchTo('Deutsch');

    await expect(page).toHaveURL(/\/de(\/|$)/);
    await expect(
      page.getByRole('heading', { name: 'Verwalte dein Vermögen wie ein Profi' })
    ).toBeVisible();
  });
});
</content>
