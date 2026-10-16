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

const numOr = (v: unknown, fallback: number): number => {
  if (v == null) return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** Resolve the effective loan policy: the chain's value wherever it was read,
 *  the labelled fallback only for what is still missing. */
export function resolveLoanPolicy(
  rawPolicy: Record<string, unknown> | null | undefined,
  consensusThreshold?: number | null
): UILoanPolicy {
  const fromChain = rawPolicy != null && consensusThreshold != null
  return {
    minInterestRate: numOr(rawPolicy?.min_interest_rate, LOAN_POLICY_FALLBACKS.minInterestRate),
    maxInterestRate: numOr(rawPolicy?.max_interest_rate, LOAN_POLICY_FALLBACKS.maxInterestRate),
    maxLoanDuration: numOr(rawPolicy?.max_loan_duration, LOAN_POLICY_FALLBACKS.maxLoanDuration),
    consensusThreshold: numOr(consensusThreshold, LOAN_POLICY_FALLBACKS.consensusThreshold),
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
  return {
    interestRate: Number(raw.interest_rate ?? 0),
    totalRepayment: asBigInt(raw.total_repayment),
    duration: Number(raw.duration ?? 0),
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
  const editingEnd = Number(raw.editing_period_end ?? 0)
  return {
    id: Number(raw.id ?? 0),
    borrower: String(raw.borrower ?? ''),
    amount: asBigInt(raw.amount),
    purpose: '', // not stored on-chain; attach a document hash instead
    interestRate: Number(raw.interest_rate ?? 0),
    status: loanStatusCode(raw),
    votesFor: Number(raw.for_votes ?? 0),
    votesAgainst: Number(raw.against_votes ?? 0),
    creationTime: Number(raw.created_at ?? 0),
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
  status: 'Active' | 'Repaid' | 'Defaulted'
  amountRepaid: bigint
}

export function mapLoan(raw: Record<string, unknown>): UILoan {
  return {
    id: Number(raw.id ?? 0),
    borrower: String(raw.borrower ?? ''),
    principal: asBigInt(raw.principal),
    interestRate: Number(raw.interest_rate ?? 0),
    totalRepayment: asBigInt(raw.total_repayment),
    startTime: Number(raw.start_time ?? 0),
    dueTime: Number(raw.due_time ?? 0),
    status: tag(raw.status) as UILoan['status'],
    amountRepaid: asBigInt(raw.amount_repaid),
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
  const status = tag(raw.status)
  const code =
    status === 'Executed'
      ? 5
      : status === 'Rejected'
        ? 4
        : status === 'ApprovedPendingDisbursement'
          ? PROPOSAL_STATUS_AWAITING_FUNDS
          : 2
  const reason = String(raw.reason ?? '')
  return {
    id: Number(raw.id ?? 0),
    proposer: String(raw.proposer ?? ''),
    title: reason || `Treasury withdrawal #${Number(raw.id ?? 0)}`,
    description: reason,
    amount: asBigInt(raw.amount),
    recipient: String(raw.destination ?? ''),
    status: code,
    votesFor: Number(raw.for_votes ?? 0),
    votesAgainst: Number(raw.against_votes ?? 0),
    creationTime: Number(raw.created_at ?? 0),
    isPrivate: !!raw.private,
    hasVoted,
  }
}

/**
 * Unified catalog mapping every contract event symbol to a human label,
 * a longer description, and an activity category.
 *
 * This is the **single source of truth** for event display text used by:
 *   - `eventLabel()` / `toAdminLogEntry()` in this file (dashboard/admin views)
 *   - `useActivityFeed()` in hooks/useNotifications.ts (notification centre)
 *
 * Adding a new contract event only requires adding one entry here (#324).
 */
export interface EventCatalogEntry {
  /** Short human label shown in tables and toasts. */
  label: string
  /** Longer sentence used in the activity feed description. */
  description: string
  /**
   * Activity category consumed by `useActivityFeed`.
   * Matches `ActivityItem['type']` from lib/pushNotifications.ts.
   */
  category: 'loan' | 'vote' | 'proposal' | 'member' | 'treasury' | 'document'
}

export const EVENT_CATALOG: Record<string, EventCatalogEntry> = {
  joined:    { label: 'New member joined',                          description: 'A member joined the DAO',                                                      category: 'member'   },
  exited:    { label: 'Member exited',                             description: 'A member withdrew their share',                                                 category: 'member'   },
  claimed:   { label: 'Yield claimed',                             description: 'A member claimed rewards',                                                      category: 'treasury' },
  loan_req:  { label: 'Loan requested',                            description: 'A new loan proposal was opened',                                                category: 'loan'     },
  loan_edit: { label: 'Loan proposal edited',                      description: 'A loan proposal was updated',                                                   category: 'loan'     },
  loan_vote: { label: 'Loan vote cast',                            description: 'A vote was cast on a loan proposal',                                            category: 'vote'     },
  loan_appr: { label: 'Loan approved',                             description: 'A loan was approved and disbursed',                                             category: 'loan'     },
  loan_rpy:  { label: 'Loan repayment',                            description: 'A loan repayment was received',                                                 category: 'loan'     },
  loan_dflt: { label: 'Loan defaulted',                            description: 'A loan was not repaid by its due date',                                         category: 'loan'     },
  loan_rej:  { label: 'Loan proposal rejected',                    description: 'A loan proposal can no longer reach quorum',                                    category: 'loan'     },
  loan_exp:  { label: 'Loan expired',                              description: 'A loan proposal expired without reaching quorum',                               category: 'loan'     },
  loan_wait: { label: 'Loan approved, awaiting treasury funds',    description: 'A loan was approved but the treasury is too small to disburse it — top up the treasury', category: 'loan' },
  interest:  { label: 'Interest distributed',                      description: 'Loan interest was distributed to members',                                      category: 'treasury' },
  tre_prop:  { label: 'Treasury withdrawal proposed',              description: 'A treasury withdrawal was proposed',                                            category: 'treasury' },
  tre_vote:  { label: 'Treasury vote cast',                        description: 'A vote was cast on a treasury proposal',                                        category: 'vote'     },
  tre_exec:  { label: 'Treasury withdrawal executed',              description: 'A treasury withdrawal was executed',                                            category: 'treasury' },
  tre_rej:   { label: 'Treasury withdrawal rejected',              description: 'A treasury withdrawal was rejected',                                            category: 'treasury' },
  tre_wait:  { label: 'Treasury withdrawal approved, awaiting funds',   description: 'A treasury withdrawal was approved but the treasury is too small to execute it — top up the treasury', category: 'treasury' },
  staked:    { label: 'Member staked',                             description: 'A member staked for voting weight',                                             category: 'treasury' },
  unstaked:  { label: 'Member unstaked',                           description: 'A member reduced their stake',                                                  category: 'treasury' },
  name_reg:  { label: 'Name registered',                           description: 'A member registered a name',                                                    category: 'member'   },
  committed: { label: 'Private vote committed',                    description: 'A commit-reveal vote was committed',                                            category: 'vote'     },
  revealed:  { label: 'Private vote revealed',                     description: 'A commit-reveal vote was revealed',                                             category: 'vote'     },
  doc_attn:  { label: 'Document attached',                         description: 'A document was attached to a proposal',                                         category: 'document' },
  init:      { label: 'DAO initialized',                           description: 'The DAO contract was initialized',                                              category: 'member'   },
  admin_add: { label: 'Admin added',                               description: 'A new admin was added to the DAO',                                              category: 'member'   },
  admin_rem: { label: 'Admin removed',                             description: 'An admin was removed from the DAO',                                             category: 'member'   },
  threshold: { label: 'Consensus threshold updated',               description: 'The voting consensus threshold was updated',                                    category: 'proposal' },
  policy:    { label: 'Loan policy updated',                       description: 'The loan policy was updated',                                                   category: 'loan'     },
  paused:    { label: 'DAO paused',                                description: 'The DAO contract was paused by an admin',                                       category: 'member'   },
  unpaused:  { label: 'DAO unpaused',                              description: 'The DAO contract was unpaused by an admin',                                     category: 'member'   },
}

/** Human-readable label for a raw contract event topic symbol (e.g. `loan_dflt`
 *  -> "Loan defaulted"). Unknown symbols fall back to the raw name rather than
 *  a generic "Unknown event" so new event types stay legible without a code change. */
export function eventLabel(symbol: unknown): string {
  const key = String(symbol ?? '').trim()
  if (!key) return 'Unknown event'
  return EVENT_CATALOG[key]?.label ?? key
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
