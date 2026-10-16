/**
 * Tests for the unified EVENT_CATALOG introduced in issue #324.
 *
 * @vitest-environment node
 *
 * Acceptance criteria:
 *   1. One catalog is the only source for event labels — ACTIVITY_META is gone.
 *   2. The notification centre renders human labels for loan_dflt, doc_attn
 *      and all admin events.
 *   3. A test fails when a known contract event has no catalog entry.
 *
 * The "fixture copy of the contract event list" referenced in #324 is provided
 * here inline (mirroring the symbols emitted by ourdao-contracts events.rs).
 * When #343 generates it automatically, this list should be replaced with an
 * import of that artifact.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { EVENT_CATALOG, eventLabel } from '@/lib/dao-mappers'

// ---------------------------------------------------------------------------
// Fixture: the complete set of event symbols the contract can emit.
// Source: ourdao-contracts/src/events.rs (pinned to the deployed version).
// ---------------------------------------------------------------------------
const CONTRACT_EVENT_SYMBOLS = [
  'joined',
  'exited',
  'claimed',
  'loan_req',
  'loan_edit',
  'loan_vote',
  'loan_appr',
  'loan_rpy',
  'loan_dflt',
  'loan_rej',
  'loan_exp',
  'loan_wait',
  'interest',
  'tre_prop',
  'tre_vote',
  'tre_exec',
  'tre_rej',
  'tre_wait',
  'staked',
  'unstaked',
  'name_reg',
  'committed',
  'revealed',
  'doc_attn',
  'init',
  'admin_add',
  'admin_rem',
  'threshold',
  'policy',
  'paused',
  'unpaused',
] as const

// ---------------------------------------------------------------------------
// 1. Coverage: every contract symbol has an entry in EVENT_CATALOG
// ---------------------------------------------------------------------------
describe('EVENT_CATALOG – completeness (#324)', () => {
  it.each(CONTRACT_EVENT_SYMBOLS)(
    'has a catalog entry for contract event "%s"',
    (symbol) => {
      expect(EVENT_CATALOG).toHaveProperty(symbol)
      const entry = EVENT_CATALOG[symbol]
      expect(entry.label).toBeTruthy()
      expect(entry.description).toBeTruthy()
      expect(['loan', 'vote', 'proposal', 'member', 'treasury', 'document']).toContain(entry.category)
    }
  )

  it('covers all symbols that previously fell back to raw symbol in ACTIVITY_META', () => {
    // These are the specific symbols called out in the issue as broken.
    const missingFromOldActivityMeta = [
      'loan_dflt',
      'doc_attn',
      'init',
      'admin_add',
      'admin_rem',
      'threshold',
      'policy',
      'paused',
      'unpaused',
      'loan_exp',
    ]
    for (const symbol of missingFromOldActivityMeta) {
      expect(EVENT_CATALOG).toHaveProperty(symbol)
      // Confirm the catalog entry is not just a raw passthrough
      expect(EVENT_CATALOG[symbol].label).not.toBe(symbol)
    }
  })
})

// ---------------------------------------------------------------------------
// 2. Human labels for the specifically-called-out events (#324 issue body)
// ---------------------------------------------------------------------------
describe('EVENT_CATALOG – human labels for previously-broken events', () => {
  it('maps loan_dflt to a human label', () => {
    expect(EVENT_CATALOG['loan_dflt'].label).toBe('Loan defaulted')
    expect(EVENT_CATALOG['loan_dflt'].category).toBe('loan')
  })

  it('maps doc_attn to a human label', () => {
    expect(EVENT_CATALOG['doc_attn'].label).toBe('Document attached')
    expect(EVENT_CATALOG['doc_attn'].category).toBe('document')
  })

  it('maps init to a human label', () => {
    expect(EVENT_CATALOG['init'].label).toBe('DAO initialized')
  })

  it('maps admin_add to a human label', () => {
    expect(EVENT_CATALOG['admin_add'].label).toBe('Admin added')
    expect(EVENT_CATALOG['admin_add'].category).toBe('member')
  })

  it('maps admin_rem to a human label', () => {
    expect(EVENT_CATALOG['admin_rem'].label).toBe('Admin removed')
    expect(EVENT_CATALOG['admin_rem'].category).toBe('member')
  })

  it('maps threshold to a human label', () => {
    expect(EVENT_CATALOG['threshold'].label).toBe('Consensus threshold updated')
  })

  it('maps policy to a human label', () => {
    expect(EVENT_CATALOG['policy'].label).toBe('Loan policy updated')
  })

  it('maps paused/unpaused to human labels', () => {
    expect(EVENT_CATALOG['paused'].label).toBe('DAO paused')
    expect(EVENT_CATALOG['unpaused'].label).toBe('DAO unpaused')
  })
})

// ---------------------------------------------------------------------------
// 3. eventLabel() is still consistent with EVENT_CATALOG entries
// ---------------------------------------------------------------------------
describe('eventLabel() derives from EVENT_CATALOG', () => {
  it.each(Object.keys(EVENT_CATALOG))(
    'eventLabel("%s") returns the catalog label',
    (symbol) => {
      expect(eventLabel(symbol)).toBe(EVENT_CATALOG[symbol].label)
    }
  )

  it('falls back to the raw symbol for unknown events', () => {
    expect(eventLabel('some_new_contract_event')).toBe('some_new_contract_event')
  })

  it('falls back to "Unknown event" for empty/null input', () => {
    expect(eventLabel('')).toBe('Unknown event')
    expect(eventLabel(undefined)).toBe('Unknown event')
  })
})

// ---------------------------------------------------------------------------
// 4. Source audit: ACTIVITY_META must not exist in useNotifications.ts
// ---------------------------------------------------------------------------
describe('source audit – no surviving ACTIVITY_META (#324)', () => {
  it('useNotifications.ts does not define ACTIVITY_META', () => {
    const source = readFileSync(
      resolve(__dirname, '../src/hooks/useNotifications.ts'),
      'utf8'
    )
    expect(source).not.toMatch(/const ACTIVITY_META/)
  })

  it('useNotifications.ts imports EVENT_CATALOG from dao-mappers', () => {
    const source = readFileSync(
      resolve(__dirname, '../src/hooks/useNotifications.ts'),
      'utf8'
    )
    expect(source).toMatch(/EVENT_CATALOG.*from.*dao-mappers/)
  })
})
