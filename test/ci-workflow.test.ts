import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ci = readFileSync(resolve(__dirname, '../.github/workflows/ci.yml'), 'utf8')

// Top-level job bodies keyed by name, from `  name:` to the next one. Commented
// lines are dropped so the #143 design note doesn't count as configuration.
const jobs = Object.fromEntries(
  ci
    .split('\njobs:\n')[1]
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n')
    .split(/^ {2}(?=[\w-]+:$)/m)
    .filter(Boolean)
    .map((body) => [body.slice(0, body.indexOf(':')), body])
)

describe('CI workflow', () => {
  it('pins every action to the same version everywhere it is used (#252)', () => {
    // Actions are pinned to a commit SHA with the release in a trailing
    // `# vX.Y.Z` comment (#390); compare that release per action.
    const versions = new Map<string, Set<string>>()
    const pinned = /^\s*(?:- )?uses: ([\w./-]+)@[0-9a-f]{40}[ \t]+#[ \t]*(v\d+(?:\.\d+)*)\s*$/gm
    for (const [, action, version] of ci.matchAll(pinned)) {
      versions.set(action, (versions.get(action) ?? new Set()).add(version))
    }
    expect(versions.size).toBeGreaterThan(0)
    for (const [action, found] of versions) {
      expect([...found], action).toHaveLength(1)
    }
    // Every `uses:` must be SHA-pinned with a version comment, so none escapes the check above.
    const usesCount = [...ci.matchAll(/^\s*(?:- )?uses: /gm)].length
    expect([...ci.matchAll(pinned)]).toHaveLength(usesCount)
  })

  it('reports every status-job dependency in the PR status comment', () => {
    const comment = readFileSync(
      resolve(__dirname, '../.github/workflows/ci-status-comment.yml'),
      'utf8'
    )
    // Rows are matched by exact job name, never by substring (`test` would also
    // match the informational Node legs and the e2e job).
    expect(comment).not.toMatch(/\.includes\(key\)/)
    expect(comment).toContain('j.name === jobName')
    const rows = [...comment.matchAll(/^\s*\['[^']+', '([^']+)', '([^']+)', '[^']+'\],$/gm)]
    expect(rows.length).toBeGreaterThan(0)
    for (const [, , jobName] of rows) {
      // A row's job name must be a real job's `name:` (or its id when unnamed).
      const unnamed = Object.keys(jobs).includes(jobName)
      expect(unnamed || ci.includes(`name: ${jobName}`), jobName).toBe(true)
    }
    const needs = jobs.status.match(/needs: \[([^\]]+)\]/)![1].split(/,\s*/)
    expect(rows.map((r) => r[1]).sort()).toEqual([...needs].sort())
  })

  it.each(['test', 'build'])('runs %s on every supported Node version (#251)', (job) => {
    expect(jobs[job]).toMatch(/node: \[20, 22, 24\]/)
    expect(jobs[job]).toContain('node-version: ${{ matrix.node }}')
    // Only the Node 20 leg may fail the run; the others are informational.
    expect(jobs[job]).toContain('continue-on-error: ${{ matrix.node != 20 }}')
  })

  it.each(['lint', 'typecheck'])('keeps %s on a single Node version (#251)', (job) => {
    expect(jobs[job]).not.toContain('matrix')
  })
})
