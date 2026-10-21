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
  PROPOSAL_STATUS_CANCELLED,
  PROPOSAL_STATUS_EXPIRED,
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
  editingPeriodEnd: number
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
      editingPeriodEnd: 0,
      isPrivate: false,
      documentHash: '',
      hasVoted,
    }
  }
  const v = parsed.data
  const editingEnd = v.editing_period_end
  // Prefer the period the contract stored on the proposal itself; the fallback
  // is only for a record that predates it or arrives without it (#185, #477).
  const votingPeriod =
    v.voting_period > 0 ? v.voting_period : GOVERNANCE_PERIOD_FALLBACKS.votingPeriod
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
    editingPeriodEnd: editingEnd,
    isPrivate: false, // loan proposals are public; treasury proposals can be private
    // The contract stores the borrower's supporting-document pointer as
    // `metadata_cid` (`None` when there isn't one); the loans list gates its
    // document indicator on this being non-empty (#476).
    documentHash: v.metadata_cid,
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

/** Every contract `ProposalStatus` variant, explicitly. An unrecognised tag is
 *  deliberately absent so it maps to 0 (unknown) rather than an open vote. */
export const TREASURY_STATUS_CODES: Record<string, number> = {
  Pending: 2,
  Approved: 3,
  Rejected: 4,
  Executed: 5,
  ApprovedPendingDisbursement: PROPOSAL_STATUS_AWAITING_FUNDS,
  Expired: PROPOSAL_STATUS_EXPIRED,
  Cancelled: PROPOSAL_STATUS_CANCELLED,
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
  const code = TREASURY_STATUS_CODES[v.status] ?? 0
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
