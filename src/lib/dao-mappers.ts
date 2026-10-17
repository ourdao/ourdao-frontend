// Pure functions mapping raw contract ScVal shapes and backend DTOs onto the
// UI's types. No React, no hooks, no I/O — the anti-corruption layer between
// what the chain/indexer hand back and what components render. Kept out of
// the hooks modules (src/hooks/dao/) on purpose; they're not data fetching.
import type { BackendEvent, BackendLoan } from '@/lib/backend'
import type { Loan } from '@/types/dao'
import { MemberStatus } from '@/types/dao'
import {
  GOVERNANCE_PERIOD_FALLBACKS,
  LOAN_POLICY_FALLBACKS,
  PROPOSAL_STATUS_AWAITING_FUNDS,
} from '@/constants'
import {
  loanSchema,
  loanProposalSchema,
  treasuryProposalSchema,
  loanTermsSchema,
  loanPolicySchema,
  parseContract,
} from '@/lib/contract-schemas'

export const asBigInt = (v: unknown): bigint => {
  try {
    return typeof v === 'bigint' ? v : BigInt((v as number | string) ?? 0)
  } catch {
    return BigInt(0)
  }
}

// A Soroban unit-enum decodes as either a bare symbol string or a one-element
// array of it; normalize both to a plain string tag.
export const tag = (v: unknown): string => String(Array.isArray(v) ? v[0] : v)

// Map an indexed backend loan onto the frontend Loan shape. The indexer tracks
// principal, outstanding balance and status; fields it doesn't yet index
// (interest rate, term, collateral) default to 0.
export function toLoan(l: BackendLoan): Loan {
  const amount = asBigInt(l.amount)
  const outstanding = asBigInt(l.outstanding)
  const amountPaid = l.repaid_amount != null
    ? asBigInt(l.repaid_amount)
    : (amount > outstanding ? amount - outstanding : BigInt(0))
  const totalInterest = l.interest_charge != null
    ? asBigInt(l.interest_charge)
    : BigInt(0)
  return {
    id: l.id,
    borrower: l.borrower,
    amount,
    interestRate: 0,
    repaymentTerm: 0,
    startTime: l.approved_ledger ?? 0,
    endTime: l.due_time ?? 0,
    amountPaid,
    totalInterest,
    isActive: l.status === 'active',
    collateralAmount: BigInt(0),
  }
}

// A Soroban unit-enum decodes as either a bare symbol string or a one-element
// array of it; normalize both to our numeric MemberStatus.
export function toMemberStatus(raw: unknown): MemberStatus {
  const t = Array.isArray(raw) ? raw[0] : raw
  return t === 'ActiveMember' ? MemberStatus.ACTIVE_MEMBER : MemberStatus.INACTIVE_MEMBER
}

export interface UILoanPolicy {
  minInterestRate: number
  maxInterestRate: number
  maxLoanDuration: number
  consensusThreshold: number
  /** False while any value is still the pre-load fallback. */
  fromChain: boolean
}

/** Resolve the effective loan policy: the chain's value wherever it was read,
 *  the labelled fallback only for what is still missing. */
export function resolveLoanPolicy(
  rawPolicy: Record<string, unknown> | null | undefined,
  consensusThreshold?: number | null
): UILoanPolicy {
  if (rawPolicy == null) {
    return {
      ...LOAN_POLICY_FALLBACKS,
      fromChain: false,
    }
  }
  const parsed = parseContract(loanPolicySchema, rawPolicy, 'LoanPolicy')
  if (!parsed.ok) {
    return {
      ...LOAN_POLICY_FALLBACKS,
      fromChain: false,
    }
  }
  const v = parsed.data
  const fromChain = consensusThreshold != null
  return {
    minInterestRate: v.min_interest_rate,
    maxInterestRate: v.max_interest_rate,
    maxLoanDuration: v.max_loan_duration,
    consensusThreshold: consensusThreshold ?? LOAN_POLICY_FALLBACKS.consensusThreshold,
    fromChain,
  }
}

/** Terms the contract would set for a loan of a given amount, as priced by
 *  `calculate_loan_terms` from the live treasury and loan policy. */
export interface UILoanTerms {
  /** Flat rate over the whole term, in basis points (not annualised). */
  interestRate: number
  totalRepayment: bigint
  /** Loan duration in seconds. */
  duration: number
}

export function mapLoanTerms(raw: Record<string, unknown>): UILoanTerms {
  const parsed = parseContract(loanTermsSchema, raw, 'LoanTerms')
  if (!parsed.ok) {
    return { interestRate: 0, totalRepayment: BigInt(0), duration: 0 }
  }
  return {
    interestRate: parsed.data.interest_rate,
    totalRepayment: parsed.data.total_repayment,
    duration: parsed.data.duration,
  }
}

/** Map the contract's phase+status onto the UI's numeric ProposalStatus. */
export function loanStatusCode(raw: Record<string, unknown>): number {
  const status = tag(raw.status)
  const phase = tag(raw.phase)
  if (status === 'Approved') return 3
  if (status === 'ApprovedPendingDisbursement') return PROPOSAL_STATUS_AWAITING_FUNDS
  if (status === 'Executed') return 5
  if (status === 'Rejected' || phase === 'Expired') return 4
  if (phase === 'Voting') return 2
  if (phase === 'Editing') return 1
  return 0
}

export interface UILoanProposal {
  id: number
  borrower: string
  amount: bigint
  purpose: string
  interestRate: number
  status: number
  votesFor: number
  votesAgainst: number
  creationTime: number
  votingStartTime: number
  votingEndTime: number
  isPrivate: boolean
  documentHash: string
  hasVoted: boolean
}

/** `hasVoted` defaults to false for call sites with no voter context (e.g. the
 *  paginated list fetch, which is shared across viewers and isn't scoped to
 *  a connected address). Pass the real value — from `useHasVoted` — wherever
 *  it's actually known for the connected wallet. */
export function mapLoanProposal(raw: Record<string, unknown>, hasVoted = false): UILoanProposal {
  const parsed = parseContract(loanProposalSchema, raw, 'LoanProposal')
  if (!parsed.ok) {
    return {
      id: 0,
      borrower: '',
      amount: BigInt(0),
      purpose: '',
      interestRate: 0,
      status: 0,
      votesFor: 0,
      votesAgainst: 0,
      creationTime: 0,
      votingStartTime: 0,
      votingEndTime: 0,
      isPrivate: false,
      documentHash: '',
      hasVoted,
    }
  }
  const v = parsed.data
  const editingEnd = v.editing_period_end
  return {
    id: v.id,
    borrower: v.borrower,
    amount: v.amount,
    purpose: '', // not stored on-chain; attach a document hash instead
    interestRate: v.interest_rate,
    status: loanStatusCode(v),
    votesFor: v.for_votes,
    votesAgainst: v.against_votes,
    creationTime: v.created_at,
    votingStartTime: editingEnd,
    votingEndTime: editingEnd ? editingEnd + GOVERNANCE_PERIOD_FALLBACKS.votingPeriod : 0,
    isPrivate: false, // loan proposals are public; treasury proposals can be private
    documentHash: '',
    hasVoted,
  }
}

// ---------------------------------------------------------------------------
// Disbursed loans
//
// A LoanProposal only tracks the vote; once approved, the contract disburses
// a separate Loan record carrying the real repayment/due-date state (see
// loans.rs::approve_and_disburse). The contract deliberately reuses the
// proposal's own id for the loan, so a loan and its originating proposal
// always refer to the same underlying request.
// ---------------------------------------------------------------------------

export interface UILoan {
  id: number
  borrower: string
  principal: bigint
  interestRate: number
  totalRepayment: bigint
  startTime: number
  dueTime: number
  status: 'Active' | 'Repaid' | 'Defaulted' | 'unknown'
  amountRepaid: bigint
}

const LOAN_STATUSES = ['Active', 'Repaid', 'Defaulted'] as const
type LoanStatus = (typeof LOAN_STATUSES)[number]

/** Type guard: a status the contract actually emits, as opposed to any string
 *  a future contract version might introduce (which map to 'unknown'). */
const isLoanStatus = (value: string): value is LoanStatus =>
  (LOAN_STATUSES as readonly string[]).includes(value)

export function mapLoan(raw: Record<string, unknown>): UILoan {
  const parsed = parseContract(loanSchema, raw, 'Loan')
  if (!parsed.ok) {
    // Return a safe default rather than throwing — the UI can render an
    // 'unknown' status, but a crash helps no one.
    return {
      id: 0,
      borrower: '',
      principal: BigInt(0),
      interestRate: 0,
      totalRepayment: BigInt(0),
      startTime: 0,
      dueTime: 0,
      status: 'unknown',
      amountRepaid: BigInt(0),
    }
  }
  const v = parsed.data
  const status = isLoanStatus(v.status) ? v.status : 'unknown'
  return {
    id: v.id,
    borrower: v.borrower,
    principal: v.principal,
    interestRate: v.interest_rate,
    totalRepayment: v.total_repayment,
    startTime: v.start_time,
    dueTime: v.due_time,
    status,
    amountRepaid: v.amount_repaid,
  }
}

export interface UITreasuryProposal {
  id: number
  proposer: string
  title: string
  description: string
  amount: bigint
  recipient: string
  status: number
  votesFor: number
  votesAgainst: number
  creationTime: number
  isPrivate: boolean
  hasVoted: boolean
}

/** See mapLoanProposal's note on `hasVoted` — same default/override contract.
 *  For a private (commit-reveal) proposal the contract's `has_voted` view
 *  reports true as soon as the voter has committed, without distinguishing
 *  that from a fully revealed vote (see `daoRead.hasVoted`); this mapper
 *  passes that same single boolean through rather than inventing a
 *  distinction the contract doesn't expose. */
export function mapTreasuryProposal(raw: Record<string, unknown>, hasVoted = false): UITreasuryProposal {
  const parsed = parseContract(treasuryProposalSchema, raw, 'TreasuryProposal')
  if (!parsed.ok) {
    return {
      id: 0,
      proposer: '',
      title: 'Unknown proposal',
      description: '',
      amount: BigInt(0),
      recipient: '',
      status: 0,
      votesFor: 0,
      votesAgainst: 0,
      creationTime: 0,
      isPrivate: false,
      hasVoted,
    }
  }
  const v = parsed.data
  const code =
    v.status === 'Executed'
      ? 5
      : v.status === 'Rejected'
        ? 4
        : v.status === 'ApprovedPendingDisbursement'
          ? PROPOSAL_STATUS_AWAITING_FUNDS
          : 2
  const reason = v.reason
  return {
    id: v.id,
    proposer: v.proposer,
    title: reason || `Treasury withdrawal #${v.id}`,
    description: reason,
    amount: v.amount,
    recipient: v.destination,
    status: code,
    votesFor: v.for_votes,
    votesAgainst: v.against_votes,
    creationTime: v.created_at,
    isPrivate: v.private,
    hasVoted,
  }
}

/** Human-readable label for a raw contract event topic symbol (e.g. `loan_dflt`
 *  -> "Loan defaulted"). Unknown symbols fall back to the raw name rather than
 *  a generic "Unknown event" so new event types stay legible without a code change. */
const EVENT_LABELS: Record<string, string> = {
  joined: 'New member joined',
  exited: 'Member exited',
  claimed: 'Yield claimed',
  loan_req: 'Loan requested',
  loan_edit: 'Loan proposal edited',
  loan_vote: 'Loan vote cast',
  loan_appr: 'Loan approved',
  loan_rpy: 'Loan repayment',
  loan_dflt: 'Loan defaulted',
  loan_rej: 'Loan proposal rejected',
  loan_exp: 'Loan expired',
  loan_wait: 'Loan approved, awaiting treasury funds',
  interest: 'Interest distributed',
  tre_prop: 'Treasury withdrawal proposed',
  tre_vote: 'Treasury vote cast',
  tre_exec: 'Treasury withdrawal executed',
  tre_rej: 'Treasury withdrawal rejected',
  tre_wait: 'Treasury withdrawal approved, awaiting funds',
  staked: 'Member staked',
  unstaked: 'Member unstaked',
  name_reg: 'Name registered',
  committed: 'Private vote committed',
  revealed: 'Private vote revealed',
  doc_attn: 'Document attached',
  init: 'DAO initialized',
  admin_add: 'Admin added',
  admin_rem: 'Admin removed',
  threshold: 'Consensus threshold updated',
  policy: 'Loan policy updated',
  paused: 'DAO paused',
  unpaused: 'DAO unpaused',
}

export function eventLabel(symbol: unknown): string {
  const key = String(symbol ?? '').trim()
  if (!key) return 'Unknown event'
  return EVENT_LABELS[key] ?? key
}

export interface AdminLogEntry {
  id: string
  symbol: string
  ledger: number
  closedAt: string
  data: unknown
}

export function toAdminLogEntry(ev: BackendEvent): AdminLogEntry {
  return { id: ev.id, symbol: ev.symbol, ledger: ev.ledger, closedAt: ev.closed_at, data: ev.data }
}
