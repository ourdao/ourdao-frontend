import axe from 'axe-core'

/**
 * Shared axe helper for issue #238.
 *
 * Runs axe-core against a rendered container and returns the violations.
 * No rule is disabled without an inline reason — a suppression without a
 * reason is worse than a failing test. Currently no rule is disabled; any
 * new violation fails the suite by design.
 */
export async function runAxe(container: HTMLElement) {
  const results = await axe.run(container, {
    resultTypes: ['violations'],
  })
  return results.violations
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
