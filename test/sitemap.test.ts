import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import sitemap from '../src/app/sitemap'

function hasPageFile(appDir: string, routePath: string): boolean {
  const segments = routePath.split('/').filter(Boolean)
  if (segments.length === 0) {
    return existsSync(path.join(appDir, 'page.tsx'))
  }

  function walk(dir: string, idx: number): boolean {
    if (idx === segments.length) {
      return existsSync(path.join(dir, 'page.tsx'))
    }
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith('(') && entry.name.endsWith(')')) {
        if (walk(path.join(dir, entry.name), idx)) return true
      } else if (entry.name === segments[idx]) {
        if (walk(path.join(dir, entry.name), idx + 1)) return true
      }
    }
    return false
  }

  return walk(appDir, 0)
}

describe('sitemap', () => {
  it('excludes non-existent routes and includes public pages that map to real page.tsx files', () => {
    const entries = sitemap()
    const paths = entries.map((entry) => new URL(entry.url).pathname)

    expect(paths).not.toContain('/staking')
    expect(paths).not.toContain('/notifications')
    expect(paths).toContain('/')
    expect(paths).toContain('/privacy')
    expect(paths).toContain('/register')

    const appDir = path.resolve(__dirname, '../src/app')
    for (const p of paths) {
      const normalized = p === '/' ? '' : p
      expect(hasPageFile(appDir, normalized)).toBe(true)
    }
  })
})
