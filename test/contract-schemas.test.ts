import { describe, expect, it } from 'vitest'
import {
  loanSchema,
  loanProposalSchema,
  treasuryProposalSchema,
  loanTermsSchema,
  loanPolicySchema,
  parseContract,
} from '@/lib/contract-schemas'
import {
  mapLoan,
  mapLoanProposal,
  mapTreasuryProposal,
  mapLoanTerms,
  resolveLoanPolicy,
} from '@/lib/dao-mappers'
import { LOAN_POLICY_FALLBACKS, GOVERNANCE_PERIOD_FALLBACKS } from '@/constants'

/**
 * #363: the contract hands `Record<string, unknown>` straight to the mappers.
 * These tests pin the boundary so a shape change, a proxy error page or an
 * unexpected enum value becomes a safe fallback — never NaN, undefined or a
 * status the UI treats as valid.
 */
describe('parseContract', () => {
  it('returns the parsed record for a valid object', () => {
    const result = parseContract(loanSchema, { id: 1, status: 'Active' }, 'Loan')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.id).toBe(1)
      expect(result.data.status).toBe('Active')
    }
  })

  it('returns a typed error naming the record when the input is not an object', () => {
    const result = parseContract(loanSchema, null, 'Loan')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Loan validation failed')
      expect(result.error).toContain('(root)')
    }
  })

  it('returns a typed error for a primitive body', () => {
    const result = parseContract(loanProposalSchema, 42, 'LoanProposal')
    expect(result.ok).toBe(false)
  })
})

describe('loanSchema field validation', () => {
  it('falls back per field for missing values', () => {
    const result = loanSchema.parse({})
    expect(result.id).toBe(0)
    expect(result.borrower).toBe('')
    expect(result.principal).toBe(BigInt(0))
    expect(result.amount_repaid).toBe(BigInt(0))
  })

  it('treats a non-numeric value as the fallback rather than NaN', () => {
    const result = loanSchema.parse({ id: 'not-a-number', interest_rate: {} })
    expect(result.id).toBe(0)
    expect(result.interest_rate).toBe(0)
  })

  it('accepts bigint amounts and numeric strings', () => {
    const result = loanSchema.parse({ principal: BigInt(500), total_repayment: '1500' })
    expect(result.principal).toBe(BigInt(500))
    expect(result.total_repayment).toBe(BigInt(1500))
  })

  it('normalizes a unit-enum status from a one-element array', () => {
    expect(loanSchema.parse({ status: ['Defaulted'] }).status).toBe('Defaulted')
    expect(loanSchema.parse({ status: 'Repaid' }).status).toBe('Repaid')
  })

  it('maps a non-string status to an empty tag', () => {
    expect(loanSchema.parse({ status: 7 }).status).toBe('')
  })
})

describe('mapLoan malformed payloads', () => {
  it('maps an unrecognized status to the explicit unknown state', () => {
    expect(mapLoan({ id: 1, status: 'SomeFutureStatus' }).status).toBe('unknown')
  })

  it('normalizes an array-form status and keeps a known status', () => {
    expect(mapLoan({ status: ['Defaulted'] }).status).toBe('Defaulted')
    expect(mapLoan({ status: 'Active' }).status).toBe('Active')
  })

  it('never produces NaN for a non-numeric id or amount', () => {
    const loan = mapLoan({ id: 'nope', principal: 'nope', due_time: 'nope' })
    expect(loan.id).toBe(0)
    expect(loan.principal).toBe(BigInt(0))
    expect(loan.dueTime).toBe(0)
    expect(Number.isNaN(loan.id)).toBe(false)
  })

  it('returns safe defaults for a non-object payload', () => {
    const loan = mapLoan(null as unknown as Record<string, unknown>)
    expect(loan).toEqual({
      id: 0,
      borrower: '',
      principal: BigInt(0),
      interestRate: 0,
      totalRepayment: BigInt(0),
      startTime: 0,
      dueTime: 0,
      status: 'unknown',
      amountRepaid: BigInt(0),
    })
  })

  it('keeps a valid payload intact', () => {
    const loan = mapLoan({
      id: 3,
      borrower: 'GBORROWER',
      principal: BigInt(1000),
      interest_rate: 500,
      total_repayment: BigInt(1100),
      start_time: 10,
      due_time: 20,
      status: 'Active',
      amount_repaid: BigInt(0),
    })
    expect(loan.id).toBe(3)
    expect(loan.borrower).toBe('GBORROWER')
    expect(loan.principal).toBe(BigInt(1000))
    expect(loan.status).toBe('Active')
  })
})

describe('mapLoanProposal malformed payloads', () => {
  it('defaults hasVoted to false for a partial record', () => {
    expect(mapLoanProposal({ id: 1 }).hasVoted).toBe(false)
  })

  it('still derives the voting window from a lone editing_period_end', () => {
    const proposal = mapLoanProposal({ editing_period_end: 1000 })
    expect(proposal.votingEndTime).toBe(1000 + GOVERNANCE_PERIOD_FALLBACKS.votingPeriod)
  })

  it('does not emit NaN for malformed vote counts', () => {
    const proposal = mapLoanProposal({ for_votes: 'x', against_votes: null })
    expect(proposal.votesFor).toBe(0)
    expect(proposal.votesAgainst).toBe(0)
  })
})

describe('mapTreasuryProposal malformed payloads', () => {
  it('falls back to a generated title and a safe status for a partial record', () => {
    const proposal = mapTreasuryProposal({ id: 9, status: 'ApprovedPendingDisbursement' })
    expect(proposal.title).toBe('Treasury withdrawal #9')
    expect(proposal.status).toBe(7)
    expect(proposal.isPrivate).toBe(false)
  })

  it('does not emit NaN for a malformed amount', () => {
    expect(mapTreasuryProposal({ id: 1, amount: 'x' }).amount).toBe(BigInt(0))
  })
})

describe('mapLoanTerms malformed payloads', () => {
  it('returns zeros rather than NaN for a malformed record', () => {
    expect(mapLoanTerms({ interest_rate: 'x', total_repayment: 'x', duration: 'x' })).toEqual({
      interestRate: 0,
      totalRepayment: BigInt(0),
      duration: 0,
    })
  })
})

describe('resolveLoanPolicy malformed payloads', () => {
  it('falls back per field, keeping any field that is valid', () => {
    const policy = resolveLoanPolicy({ min_interest_rate: 'nope', max_interest_rate: 900 }, 5000)
    expect(policy.minInterestRate).toBe(LOAN_POLICY_FALLBACKS.minInterestRate)
    expect(policy.maxInterestRate).toBe(900)
    expect(policy.maxLoanDuration).toBe(LOAN_POLICY_FALLBACKS.maxLoanDuration)
    expect(policy.consensusThreshold).toBe(5000)
  })

  it('accepts a bigint max_loan_duration', () => {
    const policy = resolveLoanPolicy({ max_loan_duration: BigInt(86400) }, 6600)
    expect(policy.maxLoanDuration).toBe(86400)
    expect(policy.fromChain).toBe(true)
  })

  it('returns the labelled fallbacks before the policy has loaded', () => {
    expect(resolveLoanPolicy(undefined, undefined)).toEqual({
      ...LOAN_POLICY_FALLBACKS,
      fromChain: false,
    })
  })
})

describe('other contract schemas', () => {
  it('treasuryProposalSchema defaults a missing private flag to false', () => {
    expect(treasuryProposalSchema.parse({}).private).toBe(false)
  })

  it('treasuryProposalSchema tolerates a 0/1 private flag', () => {
    expect(treasuryProposalSchema.parse({ private: 1 }).private).toBe(true)
    expect(treasuryProposalSchema.parse({ private: 0 }).private).toBe(false)
  })

  it('loanTermsSchema falls back per field', () => {
    const terms = loanTermsSchema.parse({ interest_rate: 'bad' })
    expect(terms.interest_rate).toBe(0)
    expect(terms.total_repayment).toBe(BigInt(0))
    expect(terms.duration).toBe(0)
  })

  it('loanPolicySchema falls back to the documented policy defaults', () => {
    const policy = loanPolicySchema.parse({})
    expect(policy.min_interest_rate).toBe(LOAN_POLICY_FALLBACKS.minInterestRate)
    expect(policy.max_interest_rate).toBe(LOAN_POLICY_FALLBACKS.maxInterestRate)
    expect(policy.max_loan_duration).toBe(LOAN_POLICY_FALLBACKS.maxLoanDuration)
  })
})
