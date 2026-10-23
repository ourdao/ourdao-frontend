// @vitest-environment jsdom
import axe from 'axe-core'
import { expect } from 'vitest'

export interface KnownA11yIssue {
  /** The axe rule ID being allow-listed (e.g., 'label', 'aria-dialog-name') */
  ruleId: string
  /** The GitHub issue tracking the fix */
  issue: string
  /**
   * Optional CSS selector scoping the exemption to matching nodes only.
   * Required for any entry that is not a whole-suite exemption.
   */
  selector?: string
  /** Explanation of why this rule is allow-listed for this component/target */
  reason: string
}

/**
 * Documented allow-list for known accessibility issues (#375).
 *
 * Entries must be scoped to a specific selector and tied to an OPEN tracking
 * issue. Rule-wide, unscoped suppressions are not permitted. The allowlist is
 * currently empty: the previously listed rules (label, aria-dialog-name,
 * region) were suppressing nothing real and their justifying issues are closed.
 */
export const KNOWN_A11Y_ALLOWLIST: KnownA11yIssue[] = []

/**
 * Shared axe helper for issues #238 and #375.
 *
 * Runs axe-core against a rendered container and returns the violations.
 */
export async function runAxe(container: HTMLElement) {
  const results = await axe.run(container, {
    resultTypes: ['violations'],
  })
  return results.violations
}

/**
 * Runs axe-core against a container, filtering out documented known issues in
 * KNOWN_A11Y_ALLOWLIST. Entries with a `selector` only suppress violations whose
 * nodes all match that selector within the container. Any remaining violation
 * will be returned and should fail the test.
 */
export async function runAxeWithAllowlist(
  container: HTMLElement,
  allowlist: KnownA11yIssue[] = KNOWN_A11Y_ALLOWLIST
) {
  const violations = await runAxe(container)
  return violations
    .map((v) => {
      const scoped = allowlist.filter((item) => item.ruleId === v.id)
      if (scoped.length === 0) return v
      const remainingNodes = v.nodes.filter((node) => {
        const target = node.target.join(' ')
        const element = container.querySelector(
          node.target.filter((t): t is string => typeof t === 'string').join(' ')
        ) as HTMLElement | null
        return !scoped.some((item) => {
          if (!item.selector) return false
          if (element && element.matches(item.selector)) return true
          return target.includes(item.selector)
        })
      })
      if (remainingNodes.length === 0) return null
      return { ...v, nodes: remainingNodes }
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
}

export function formatViolations(
  violations: Awaited<ReturnType<typeof runAxe>>
): string {
  return violations
    .map((v) => `- ${v.id} (${v.impact}): ${v.description}\n  ${v.nodes.map((n) => n.target.join(', ')).join(' | ')}`)
    .join('\n')
}

/**
 * Direct accessible-name check for interactive elements.
 * Catches title-only icon buttons (e.g. the pre-fix notification bell) that
 * axe's `button-name` also flags but that deserve an explicit assertion with
 * a clear message.
 */
export function assertInteractiveNames(container: HTMLElement): void {
  const elements = container.querySelectorAll(
    'button, a[href], input, select, textarea, [role="button"], [role="link"]'
  )
  const unnamed: string[] = []
  elements.forEach((el) => {
    const html = el as HTMLElement
    // Hidden elements (e.g. Radix portals closed) are not actionable.
    if (html.getAttribute('aria-hidden') === 'true') return
    const ariaLabel = html.getAttribute('aria-label')
    const labelledBy = html.getAttribute('aria-labelledby')
    const text = (html.textContent || '').trim()
    const value = (html as HTMLInputElement).value
    const title = html.getAttribute('title')
    // `title` alone is not a reliable accessible name — require a real name.
    const named = Boolean(
      (ariaLabel && ariaLabel.trim()) ||
        labelledBy ||
        text ||
        (typeof value === 'string' && value.trim())
    )
    if (!named) {
      unnamed.push(
        `${html.tagName.toLowerCase()}${html.className ? `.${String(html.className).split(' ').slice(0, 2).join('.')}` : ''}${title ? `[title=${title}]` : ''}`
      )
    }
  })
  if (unnamed.length > 0) {
    throw new Error(
      `Interactive elements without an accessible name (aria-label or visible text; title alone is insufficient):\n- ${unnamed.join('\n- ')}`
    )
  }
}

function channelToLinear(channel: number): number {
  const srgb = channel / 255
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
}

export function contrastRatio(foreground: string, background: string): number {
  const parse = (hex: string) => {
    const normalized = hex.replace('#', '')
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
      throw new Error(`Expected a 6-digit hex colour, received ${hex}`)
    }
    const value = Number.parseInt(normalized, 16)
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
    }
  }

  const fg = parse(foreground)
  const bg = parse(background)
  const luminance = ({ r, g, b }: typeof fg) =>
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  const lighter = Math.max(luminance(fg), luminance(bg))
  const darker = Math.min(luminance(fg), luminance(bg))
  return (lighter + 0.05) / (darker + 0.05)
}

export function expectWcagAAContrast(
  foreground: string,
  background: string,
  minimum = 4.5
): void {
  expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(minimum)
}
