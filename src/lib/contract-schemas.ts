import { z } from 'zod'
import { LOAN_POLICY_FALLBACKS } from '@/constants'

/**
 * Runtime validation for the contract structs returned by `daoRead`.
 *
 * The contract decodes ScVal results into `Record<string, unknown>` and hands
 * them straight to the mappers in ./dao-mappers. Without validation a shape
 * change (a new field, a renamed one, a proxy error page) or an unexpected enum
 * value silently becomes `NaN`, `undefined` or a status that looks valid but
 * is not one the UI knows how to render (#363).
 *
 * The fields are validated **independently** and each falls back to its own
 * safe default. A whole-record rejection is deliberately avoided: the contract
 * is versioned separately from this app, so a single missing field must not
 * blank an entire record. What a mapper cannot recover from — an unknown enum
 * value — is mapped to an explicit `'unknown'` state rather than cast into the
 * union as if it were valid.
 */

/** Coerce to a finite number, or `fallback` for anything missing/unparseable. */
const finiteNumber = (fallback: number) =>
  z.unknown().optional().transform((value) => {
    if (value == null) return fallback
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  })

/** Coerce to a bigint, or `fallback` for anything missing/unparseable. */
const bigintValue = (fallback: bigint) =>
  z.unknown().optional().transform((value) => {
    if (value == null) return fallback
    try {
      return BigInt(value as number | string)
    } catch {
      return fallback
    }
  })

/** Coerce to a string, or `fallback` for anything missing. */
const stringValue = (fallback: string) =>
  z.unknown().optional().transform((value) => {
    if (value == null) return fallback
    return typeof value === 'string' ? value : String(value)
  })

/** Normalize a Soroban unit-enum — a bare symbol string or a one-element
 *  array of it — to its plain tag, or `''` when it is neither. */
const enumTag = z.unknown().optional().transform((value) => {
  const tag = Array.isArray(value) ? value[0] : value
  return typeof tag === 'string' ? tag : ''
})

/** Coerce to a boolean, tolerating the contract's `0`/`1` encoding. */
const booleanValue = (fallback: boolean) =>
  z.unknown().optional().transform((value) => {
    if (typeof value === 'boolean') return value
    if (value === 0 || value === 1) return value === 1
    return fallback
  })

// --- Contract structs --------------------------------------------------------

export const loanSchema = z.object({
  id: finiteNumber(0),
  borrower: stringValue(''),
  principal: bigintValue(BigInt(0)),
  interest_rate: finiteNumber(0),
  total_repayment: bigintValue(BigInt(0)),
  start_time: finiteNumber(0),
  due_time: finiteNumber(0),
  status: enumTag,
  amount_repaid: bigintValue(BigInt(0)),
})

export const loanProposalSchema = z.object({
  id: finiteNumber(0),
  borrower: stringValue(''),
  amount: bigintValue(BigInt(0)),
  interest_rate: finiteNumber(0),
  status: enumTag,
  phase: enumTag,
  for_votes: finiteNumber(0),
  against_votes: finiteNumber(0),
  created_at: finiteNumber(0),
  editing_period_end: finiteNumber(0),
  // The period the contract recorded on *this* proposal (u64 seconds). An
  // admin's policy change only affects proposals created afterwards, so this
  // — not the constants fallback — is what the deadline is derived from (#477).
  voting_period: finiteNumber(0),
  // `Option<string>` on the contract: absent (`None`) until the borrower
  // supplies a supporting document with the request (#476).
  metadata_cid: stringValue(''),
})

export const treasuryProposalSchema = z.object({
  id: finiteNumber(0),
  proposer: stringValue(''),
  amount: bigintValue(BigInt(0)),
  destination: stringValue(''),
  status: enumTag,
  reason: stringValue(''),
  for_votes: finiteNumber(0),
  against_votes: finiteNumber(0),
  created_at: finiteNumber(0),
  private: booleanValue(false),
})

export const loanTermsSchema = z.object({
  interest_rate: finiteNumber(0),
  total_repayment: bigintValue(BigInt(0)),
  duration: finiteNumber(0),
})

export const loanPolicySchema = z.object({
  min_interest_rate: finiteNumber(LOAN_POLICY_FALLBACKS.minInterestRate),
  max_interest_rate: finiteNumber(LOAN_POLICY_FALLBACKS.maxInterestRate),
  max_loan_duration: finiteNumber(LOAN_POLICY_FALLBACKS.maxLoanDuration),
  membership_contribution: bigintValue(BigInt(0)),
  max_loan_to_treasury_ratio: finiteNumber(0),
})

// --- Validation helper -------------------------------------------------------

/**
 * Parse a contract struct against its schema, returning a typed error rather
 * than throwing. The error names the record and the offending field path so a
 * shape drift is diagnosable from a log line.
 */
export function parseContract<T>(
  schema: z.ZodType<T>,
  data: unknown,
  label: string
): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) return { ok: true, data: result.data }
  const issues = result.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ')
  return { ok: false, error: `${label} validation failed: ${issues}` }
}
