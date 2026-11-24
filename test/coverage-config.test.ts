import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Issue #240 — no coverage measurement or threshold in CI.
 * These assert the measurement exists: a `coverage` script, a V8 provider
 * with per-file reporters and a ratchet threshold, sensible excludes, and a
 * CI job that enforces it and publishes the summary to the job output.
 * Dropping any piece fails the suite by design. Out of scope: raising the
 * number — gaps become their own issues.
 */
describe('issue #240 — coverage measurement and threshold', () => {
  it('exposes a coverage script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    expect(pkg.scripts?.coverage).toMatch(/vitest.*--coverage/)
  })

  it('declares a V8 coverage provider matching the locked Vitest version', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as {
      devDependencies: Record<string, string>
    }
    const lock = JSON.parse(fs.readFileSync(path.resolve('package-lock.json'), 'utf8')) as {
      packages: Record<string, { version: string }>
    }
    const provider = '@vitest/coverage-v8'
    const version = lock.packages['node_modules/vitest'].version

    expect(pkg.devDependencies[provider]).toBe(version)
    expect(lock.packages[`node_modules/${provider}`].version).toBe(version)
  })

  it('configures the V8 provider with per-file reporters and excludes', () => {
    const cfg = fs.readFileSync(path.resolve('vitest.config.mts'), 'utf8')
    expect(cfg).toContain("provider: 'v8'")
    expect(cfg).toContain("'text'")
    expect(cfg).toContain("'json-summary'")
    // Generated files and configuration are excluded from measurement.
    expect(cfg).toContain('test/**')
    expect(cfg).toContain('next.config.ts')
    expect(cfg).toContain('vitest.config.mts')
    // A ratchet threshold is set so coverage is enforced without failing on
    // adoption; follow-ups raise it once the first CI summary lands.
    expect(cfg).toContain('thresholds')
    expect(cfg).toContain('lines:')
    expect(cfg).toContain('functions:')
    expect(cfg).toContain('branches:')
    expect(cfg).toContain('statements:')
  })

  it('enforces coverage in CI and publishes the summary to the job output', () => {
    const ci = fs.readFileSync(path.resolve('.github/workflows/ci.yml'), 'utf8')
    expect(ci).toContain('name: Coverage')
    expect(ci).toContain('npm run coverage')
    expect(ci).not.toContain('--no-save @vitest/coverage-v8')
    expect(ci).toContain('GITHUB_STEP_SUMMARY')
    expect(ci).toContain('coverage/coverage-summary.json')
    // Enforced: the aggregate status job depends on coverage.
    // Match only the dependency, so adding another job to `needs` does not break this.
    const needs = ci.match(/^ {2}status:[\s\S]*?\n {4}needs:\s*\[([^\]]+)\]/m)
    expect(needs?.[1].split(/,\s*/)).toContain('coverage')
  })
})
