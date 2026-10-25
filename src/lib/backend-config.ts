/**
 * Where `ourdao-backend` lives, and whether it is configured at all.
 *
 * Split out of `src/lib/backend.ts` so the authenticated-mutation path
 * (`src/lib/backend-auth.ts`) can reach the same values without importing
 * `backend.ts` — which imports *this* module's consumer for its write helpers,
 * and a cycle between the two would leave one of them reading a
 * half-initialised binding depending on which module the bundler evaluated
 * first.
 *
 * `NEXT_PUBLIC_BACKEND_URL` empty (the default) is "preview mode": the app runs
 * entirely against the contract, and every backend-derived read resolves to its
 * empty fallback rather than failing.
 *
 * Hooks must import `isBackendConfigured` from here (or `@/lib/backend`) rather
 * than defining local copies, so gating behaviour stays identical everywhere,
 * including under test. Tests that need a configured backend should stub the
 * env var or mock `@/lib/backend-config`.
 */

/** Base URL of the indexer API, or '' when unconfigured. */
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''

export const isBackendConfigured = (): boolean => !!process.env.NEXT_PUBLIC_BACKEND_URL
