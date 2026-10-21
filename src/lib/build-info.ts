/**
 * Identifies the running build so a bug report can name it and be traced to
 * a CHANGELOG.md entry (#250). Both values are inlined at build time by
 * next.config.ts `env`; `dev` means the config didn't run (e.g. under vitest).
 */
/**
 * Stable key for this build, used to version the service worker cache (#479).
 * The commit sha changes on every deploy; the package version is the fallback
 * when a build has no sha (local `next build`); `dev` under `next dev`.
 */
export function buildId(): string {
  return (
    process.env.NEXT_PUBLIC_GIT_SHA ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    'dev'
  )
}

export function buildLabel(): string {
  const version = process.env.NEXT_PUBLIC_APP_VERSION || 'dev'
  const sha = process.env.NEXT_PUBLIC_GIT_SHA
  return sha ? `v${version} (${sha.slice(0, 7)})` : `v${version}`
}
