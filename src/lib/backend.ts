'use client'

/**
 * Client for the OurDAO backend (ourdao-backend) — the off-chain indexer +
 * read API. The Soroban contract stays the source of truth for writes and
 * live member/treasury reads; the backend supplies history and aggregates the
 * chain can't cheaply serve (loan history, notifications, the event feed).
 *
 * Reads degrade rather than crash the app, but they no longer disguise a
 * failure as "no data": when the backend is not configured (preview mode) a
 * read resolves to its empty fallback, but when it IS configured and the
 * request fails (unreachable, CORS, non-2xx) the read rejects with a
 * BackendError. TanStack Query surfaces that as `isError` on the hook, and the
 * consumer renders a "couldn't load" state — an unreachable indexer and an
 * empty loan list must not look the same to a member.
 */

/** A configured backend could not be read (network failure or non-2xx). */
export class BackendError extends Error {
  readonly status: number | null
  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'BackendError'
    this.status = status
  }
}

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''

export const isBackendConfigured = (): boolean => !!process.env.NEXT_PUBLIC_BACKEND_URL

// --- Response shapes (mirror ourdao-backend/src/types.ts as of commit 7620d26; amounts are strings) ---

export interface BackendStats {
  totalMembers: number
  activeMembers: number
  totalLoanProposals: number
  totalLoans: number
  activeLoans: number
  defaultedLoans: number
  totalTreasuryProposals: number
  totalStaked: string
  lastIndexedLedger: number | null
  secondsSinceUpdate: number | null
  indexerStale: boolean
  totalDefaultedValue: string
  interestCollected: string
  principalLent: string
  principalRepaid: string
  valueDefaulted: string
}

// Verified against LoanRow and /api/loans withLoanDerived route in ourdao-backend @ 7620d26
export interface BackendLoan {
  id: number
  borrower: string
  amount: string
  outstanding: string
  total_repayment: string
  due_time: number | null
  status: 'active' | 'repaid' | 'defaulted'
  approved_ledger: number | null
  repaid_ledger: number | null
  defaulted_ledger: number | null
  updated_at: string
  interest_charge?: string | null
  repaid_amount?: string | null
}

export interface BackendNotification {
  id: number
  address: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  ledger: number | null
  tx_hash: string | null
  read: boolean
  created_at: string
}

export interface BackendEvent {
  id: string
  ledger: number
  closed_at: string
  contract_id: string
  symbol: string
  topics: unknown
  data: unknown
  tx_hash: string | null
  created_at: string
}

// --- Fetch helper -----------------------------------------------------------

// None of these fetches set a timeout or abort signal, so a hung indexer leaves
// a request pending indefinitely instead of degrading to the on-chain-only state.

async function get<T>(path: string, fallback: T): Promise<T> {
  // Preview mode: nothing to read from, so the empty fallback is the truth.
  if (!isBackendConfigured()) return fallback
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || ''
  let res: Response
  try {
    res = await fetch(`${base}${path}`, {
      headers: { accept: 'application/json' },
      // Indexed data changes often; never serve a stale cache.
      cache: 'no-store',
    })
  } catch (cause) {
    // Backend down / CORS / network.
    throw new BackendError(
      `Backend unreachable: ${cause instanceof Error ? cause.message : String(cause)}`
    )
  }
  if (!res.ok) throw new BackendError(`Backend responded ${res.status}`, res.status)
  return (await res.json()) as T
}

/** PATCH with no body. Returns whether the backend accepted the mutation. */
async function patch(path: string): Promise<boolean> {
  if (!isBackendConfigured()) return false
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || ''
  try {
    const res = await fetch(`${base}${path}`, { method: 'PATCH' })
    return res.ok
  } catch {
    return false
  }
}

// --- Endpoints --------------------------------------------------------------

export const backend = {
  getStats: () => get<BackendStats | null>('/api/stats', null),

  getLoans: (borrower?: string) =>
    get<BackendLoan[]>(
      borrower ? `/api/loans?borrower=${encodeURIComponent(borrower)}` : '/api/loans',
      []
    ),

  getLoan: (id: number) => get<BackendLoan | null>(`/api/loans/${id}`, null),

  getNotifications: (address: string, limit = 50) =>
    get<BackendNotification[]>(
      `/api/notifications?address=${encodeURIComponent(address)}&limit=${limit}`,
      []
    ),

  getEvents: (limit = 50, symbol?: string) =>
    get<BackendEvent[]>(
      symbol
        ? `/api/events?symbol=${encodeURIComponent(symbol)}&limit=${limit}`
        : `/api/events?limit=${limit}`,
      []
    ),

  getAdminLog: (limit = 50) => get<BackendEvent[]>(`/api/admin/log?limit=${limit}`, []),

  markNotificationRead: (id: number) => patch(`/api/notifications/${id}/read`),

  markAllNotificationsRead: (address: string) =>
    patch(`/api/notifications/read-all?address=${encodeURIComponent(address)}`),
}
