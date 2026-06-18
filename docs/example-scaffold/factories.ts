import { type APIRequestContext } from '@playwright/test';

/**
 * Test-data factories — the builder API over the test-data / state control plane.
 *
 * For Ghostfolio the only identity primitive is a security-token account, so the
 * factory is small. On a richer investment platform this is where you'd build
 * funded accounts, seeded portfolios, pending orders, pinned FX rates, etc.,
 * each via API so non-happy-path preconditions are cheap and deterministic.
 */

export interface SeededAccount {
  /** 128-hex-char security token (acts as the credential). */
  token: string;
  /** JWT bearer for the authenticated session. */
  authToken: string;
}

/**
 * Create a fresh anonymous account via the API (set-up-via-API), bypassing the
 * registration UI. Endpoints DISCOVERED by the Surveyor — confirm at the gate.
 */
export async function createSeededAccount(request: APIRequestContext): Promise<SeededAccount> {
  // DISCOVERED — confirm: POST /api/v1/user → { accessToken }
  const created = await request.post('/api/v1/user');
  const { accessToken: token } = await created.json();

  // DISCOVERED — confirm: GET /api/v1/auth/anonymous/{token} → { authToken }
  const session = await request.get(`/api/v1/auth/anonymous/${token}`);
  const { authToken } = await session.json();

  return { token, authToken };
}
</content>
