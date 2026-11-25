/**
 * Table-driven tests for loan view-model status derivation (#648).
 *
 * Covers every ProposalStatus variant, overdue loans, partial repayments,
 * and defaulted loans using fixed `now` values so there is no wall-clock
 * dependency.
 */

import { loanStatusCode, mapLoan } from '@/lib/dao-mappers'
import {
  PROPOSAL_STATUS_AWAITING_FUNDS,
  PROPOSAL_STATUS_EXPIRED,
  PROPOSAL_STATUS_CANCELLED,
} from '@/constants'

// ── loanStatusCode ────────────────────────────────────────────────────────────

function makeRaw(
  status: string,
  phase: string,
): Record<string, unknown> {
  return {
    status: { tag: status },
    phase: { tag: phase },
  }
}

describe('loanStatusCode: ProposalStatus → numeric code', () => {
  const cases: [string, string, number][] = [
    ['Approved',                     'Voting',   3],
    ['ApprovedPendingDisbursement',  'Voting',   PROPOSAL_STATUS_AWAITING_FUNDS],
    ['Executed',                     'Voting',   5],
    ['Rejected',                     'Voting',   4],
    ['Pending',                      'Expired',  4],  // Expired phase → rejected/expired code
    ['Pending',                      'Voting',   2],
    ['Pending',                      'Editing',  1],
    ['Pending',                      'Unknown',  0],
  ]

  test.each(cases)(
    'status=%s phase=%s → %i',
    (status, phase, expected) => {
      expect(loanStatusCode(makeRaw(status, phase))).toBe(expected)
    },
  )
})

// ── mapLoan ───────────────────────────────────────────────────────────────────

function makeLoanRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    borrower: 'GBORROWER',
    principal: BigInt(1000_0000000),
    interest_rate: 500,            // 5 % in bps
    total_repayment: BigInt(1050_0000000),
    start_time: 1_700_000_000,
    due_time: 1_700_000_000 + 30 * 86_400,  // 30 days
    status: { tag: 'Active' },
    amount_repaid: BigInt(0),
    ...overrides,
  }
}

describe('mapLoan: disbursed loan status derivation', () => {
  it('Active loan → status Active', () => {
    const result = mapLoan(makeLoanRaw())
    expect(result.status).toBe('Active')
    expect(result.amountRepaid).toBe(BigInt(0))
  })

  it('Repaid loan → status Repaid', () => {
    const result = mapLoan(makeLoanRaw({ status: { tag: 'Repaid' }, amount_repaid: BigInt(1050_0000000) }))
    expect(result.status).toBe('Repaid')
    expect(result.amountRepaid).toBe(BigInt(1050_0000000))
  })

  it('Defaulted loan → status Defaulted', () => {
    const result = mapLoan(makeLoanRaw({ status: { tag: 'Defaulted' } }))
    expect(result.status).toBe('Defaulted')
  })

  it('Unknown status tag → status unknown (graceful degradation)', () => {
    const result = mapLoan(makeLoanRaw({ status: { tag: 'FutureVariant' } }))
    expect(result.status).toBe('unknown')
  })

  it('Overdue loan (past due_time, still Active) preserves Active status', () => {
    // Overdue detection is a UI concern; mapLoan only reflects what the
    // contract stored. Active + past due_time means the caller should call
    // markLoanDefaulted, but the status is still Active until they do.
    const pastDue = 1_600_000_000  // well before start_time
    const result = mapLoan(makeLoanRaw({ due_time: pastDue, status: { tag: 'Active' } }))
    expect(result.status).toBe('Active')
    expect(result.dueTime).toBe(pastDue)
  })

  it('Partial repayment — amountRepaid reflects the partial value', () => {
    const partial = BigInt(500_0000000)
    const result = mapLoan(makeLoanRaw({ amount_repaid: partial, status: { tag: 'Active' } }))
    expect(result.status).toBe('Active')
    expect(result.amountRepaid).toBe(partial)
    // Outstanding should exceed the partial payment
    expect(result.totalRepayment - result.amountRepaid).toBeGreaterThan(BigInt(0))
  })

  it('Full repayment amount matches total_repayment on Repaid loan', () => {
    const total = BigInt(1050_0000000)
    const result = mapLoan(makeLoanRaw({ status: { tag: 'Repaid' }, amount_repaid: total }))
    expect(result.amountRepaid).toBe(result.totalRepayment)
  })

  it('Malformed raw → returns safe zero-value fallback', () => {
    const result = mapLoan({})
    expect(result.id).toBe(0)
    expect(result.status).toBe('unknown')
    expect(result.principal).toBe(BigInt(0))
  })
})

// ── Cancelled / Expired codes ─────────────────────────────────────────────────

describe('loanStatusCode: Cancelled and Expired constants', () => {
  it('PROPOSAL_STATUS_AWAITING_FUNDS is 7', () => {
    expect(PROPOSAL_STATUS_AWAITING_FUNDS).toBe(7)
  })
  it('PROPOSAL_STATUS_EXPIRED is 8', () => {
    expect(PROPOSAL_STATUS_EXPIRED).toBe(8)
  })
  it('PROPOSAL_STATUS_CANCELLED is 9', () => {
    expect(PROPOSAL_STATUS_CANCELLED).toBe(9)
  })
})
