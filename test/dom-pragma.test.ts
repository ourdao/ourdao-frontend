import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guard for #539 (regression of #373 / #473).
 *
 * vitest.config.mts defaults to `environment: 'node'`. A test file that touches
 * the DOM must opt in with `// @vitest-environment jsdom` (or happy-dom) in its
 * header, otherwise it fails at runtime with `window is not defined`. This
 * check fails the suite when such a file lands without the pragma.
 */

const ROOT = join(__dirname, '..')
const TEST_FILE = /\.test\.tsx?$/
const SKIP_DIRS = new Set(['node_modules', '.next', 'coverage', 'e2e', 'visual'])

export const PRAGMA = /^\s*\/\/\s*@vitest-environment\s+(jsdom|happy-dom)\b/m
// Browser-only globals and DOM test libraries. `navigator` is deliberately
// absent: Node 21+ defines it, so it does not need jsdom.
export const DOM_USAGE =
  /\b(window|document)\.|\b(localStorage|sessionStorage)\b|\bmatchMedia\b|@testing-library\/react|renderWithProviders/

export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

export function needsDom(source: string): boolean {
  return DOM_USAGE.test(stripComments(source))
}

export function hasPragma(source: string): boolean {
  return PRAGMA.test(source.split('\n').slice(0, 5).join('\n'))
}

function collect(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) collect(full, out)
    else if (TEST_FILE.test(name)) out.push(full)
  }
  return out
}

describe('jsdom pragma guard (#539)', () => {
  it('every test file that touches the DOM declares a jsdom environment', () => {
    const offenders = [...collect(join(ROOT, 'test')), ...collect(join(ROOT, 'src'))]
      .filter((file) => {
        // This file quotes the patterns it searches for.
        if (file === __filename) return false
        const source = readFileSync(file, 'utf8')
        return needsDom(source) && !hasPragma(source)
      })
      .map((file) => relative(ROOT, file))

    expect(
      offenders,
      `Add "// @vitest-environment jsdom" as the first line of: ${offenders.join(', ')}`,
    ).toEqual([])
  })

  it('flags a DOM-touching file without the pragma', () => {
    const src = "afterEach(() => window.localStorage.clear())\n"
    expect(needsDom(src)).toBe(true)
    expect(hasPragma(src)).toBe(false)
  })

  it('accepts a DOM-touching file that declares the pragma', () => {
    const src = "// @vitest-environment jsdom\nwindow.localStorage.clear()\n"
    expect(needsDom(src)).toBe(true)
    expect(hasPragma(src)).toBe(true)
  })

  it('ignores DOM words that only appear in comments', () => {
    expect(needsDom('// uses window.localStorage in prod\nconst a = 1')).toBe(false)
  })

  it('does not treat navigator as DOM-only', () => {
    expect(needsDom('const l = navigator.language')).toBe(false)
  })
})
