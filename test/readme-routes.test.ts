import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const appDir = join(root, 'src', 'app')

function findPageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const fullPath = join(dir, name)
    if (statSync(fullPath).isDirectory()) {
      return findPageFiles(fullPath)
    }
    // Only match actual page.tsx files (exclude .dev.tsx or other variants)
    return name === 'page.tsx' ? [fullPath] : []
  })
}

function filePathToRoute(pageFilePath: string): string {
  const rel = relative(appDir, pageFilePath)
  // Strip trailing '/page.tsx' or 'page.tsx'
  const withoutPage = rel.replace(/(^|\/)page\.tsx$/, '')
  // Filter out route groups like (app)
  const segments = withoutPage
    .split('/')
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))

  return `/${segments.join('/')}`
}

function parseReadmeRoutesTable(): Map<string, string> {
  const readmeContent = readFileSync(join(root, 'README.md'), 'utf8')
  const routesSection = readmeContent.split(/## Routes/i)[1]
  if (!routesSection) {
    throw new Error('Could not find ## Routes section in README.md')
  }

  // Stop at the next major section (## Architecture or similar)
  const tablePart = routesSection.split(/##\s+/)[0]
  const rows = tablePart.split('\n')

  const routeMap = new Map<string, string>()

  for (const row of rows) {
    const trimmed = row.trim()
    if (!trimmed.startsWith('|') || trimmed.includes('|---|') || trimmed.includes('| Route |')) {
      continue
    }

    const cols = trimmed
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean)

    if (cols.length >= 2) {
      // cols[0] is like `/loans/[id]` or `/`
      const route = cols[0].replace(/[`]/g, '')
      const description = cols[1]
      routeMap.set(route, description)
    }
  }

  return routeMap
}

describe('README routes documentation (#590)', () => {
  const pageFiles = findPageFiles(appDir)
  const appRoutes = pageFiles.map(filePathToRoute)
  const readmeRoutes = parseReadmeRoutesTable()

  it('contains /exit, /members, /members/[address] and /treasury/[id]', () => {
    expect(readmeRoutes.has('/exit')).toBe(true)
    expect(readmeRoutes.has('/members')).toBe(true)
    expect(readmeRoutes.has('/members/[address]')).toBe(true)
    expect(readmeRoutes.has('/treasury/[id]')).toBe(true)
  })

  it('documents every page.tsx route under src/app in the README routes table', () => {
    for (const route of appRoutes) {
      expect(
        readmeRoutes.has(route),
        `Route "${route}" from page.tsx is missing in README.md "Routes" table`,
      ).toBe(true)
    }
  })

  it('each route description is non-empty and descriptive', () => {
    for (const [route, description] of readmeRoutes.entries()) {
      expect(description.length, `Description for ${route} should not be empty`).toBeGreaterThan(10)
    }
  })
})
