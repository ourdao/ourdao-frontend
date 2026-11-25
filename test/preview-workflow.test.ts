import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Issue #528 — the Deploy Preview comment step must reach the deployment URL
 * through `env:` (not the bare `steps` identifier, which is undefined inside
 * actions/github-script) and must await the comment call so failures surface.
 */
const preview = readFileSync(
  resolve(__dirname, '../.github/workflows/preview.yml'),
  'utf8'
).replace(/\r\n/g, '\n')

const commentStep = preview.slice(preview.indexOf('- name: Add preview comment'))
const scriptBody = commentStep.slice(commentStep.indexOf('script: |'))

describe('preview workflow comment step (#528)', () => {
  it('does not reference the bare `steps` context inside the github-script body', () => {
    expect(scriptBody).not.toMatch(/(^|[^.\w])steps\./m)
  })

  it('passes the deployment URL to the script through env', () => {
    expect(commentStep).toContain('PAGE_URL: ${{ steps.deployment.outputs.page_url }}')
    expect(scriptBody).toContain('const deploymentUrl = process.env.PAGE_URL;')
  })

  it('awaits the createComment call so a rejected request fails the step', () => {
    expect(scriptBody).toMatch(/await github\.rest\.issues\.createComment\(/)
  })
})
