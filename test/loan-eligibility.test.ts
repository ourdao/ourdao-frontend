import { afterEach, describe, expect, it, vi } from 'vitest'
import { deriveLoanEligibility, describeLoanIneligibility } from '@/hooks/useDAO'

// A fixed unix second so the "time remaining" assertions are stable.
const NOW = 1_700_000_000

describe('deriveLoanEligibility', () => {
  afterEach(() => vi.useRealTimers())

  it('is eligible when the contract says so', () => {
    expect(deriveLoanEligibility({ eligible: true, policy: null, member: null })).toEqual({
      eligible: true,
    })
  })

  it('is eligible (unknown yet) before the read has returned', () => {
    expect(deriveLoanEligibility(undefined)).toEqual({ eligible: true })
  })

  it('explains an active loan', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW * 1000)
    expect(
      deriveLoanEligibility({
        eligible: false,
        policy: { min_membership_duration: 0, cooldown_period: 0 },
        member: { has_active_loan: true },
      })
    ).toEqual({ eligible: false, reason: 'active-loan', eligibleAt: null })
  })

  it('explains a too-new member and when they become eligible', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW * 1000)
    const result = deriveLoanEligibility({
      eligible: false,
      policy: { min_membership_duration: 86400, cooldown_period: 0 },
      member: { has_active_loan: false, join_time: NOW - 3600, last_loan_time: 0 },
    })
    expect(result).toEqual({ eligible: false, reason: 'too-new', eligibleAt: NOW - 3600 + 86400 })
  })

  it('explains a cooldown and when it ends', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW * 1000)
    const result = deriveLoanEligibility({
      eligible: false,
      policy: { min_membership_duration: 0, cooldown_period: 86400 },
      member: {
        has_active_loan: false,
        join_time: NOW - 10 * 86400,
        last_loan_time: NOW - 1800,
      },
    })
    expect(result).toEqual({
      eligible: false,
      reason: 'cooling-down',
      eligibleAt: NOW - 1800 + 86400,
    })
  })

  it('falls back to an unknown reason when no field explains it', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW * 1000)
    expect(
      deriveLoanEligibility({
        eligible: false,
        policy: {},
        member: { has_active_loan: false, join_time: NOW - 10 * 86400, last_loan_time: 0 },
      })
    ).toEqual({ eligible: false, reason: 'unknown', eligibleAt: null })
  })
})

describe('describeLoanIneligibility', () => {
  it('is empty when eligible', () => {
    expect(describeLoanIneligibility({ eligible: true })).toBe('')
  })

  it('names each reason', () => {
    expect(
      describeLoanIneligibility({ eligible: false, reason: 'active-loan', eligibleAt: null })
    ).toMatch(/active loan/i)
    expect(
      describeLoanIneligibility({ eligible: false, reason: 'too-new', eligibleAt: null })
    ).toMatch(/minimum period/i)
    expect(
      describeLoanIneligibility({ eligible: false, reason: 'cooling-down', eligibleAt: null })
    ).toMatch(/cooldown/i)
    expect(
      describeLoanIneligibility({ eligible: false, reason: 'unknown', eligibleAt: null })
    ).toMatch(/not consider you eligible/i)
  })
})
