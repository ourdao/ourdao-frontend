// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from './test-utils'
import AdminPage from '@/app/(app)/admin/page'

const mockIsMember = vi.fn()
const mockIsAdmin = vi.fn()
const mockGetMember = vi.fn()
const mockGetPendingYield = vi.fn()
const mockGetAdmins = vi.fn()
const mockGetTotalMembers = vi.fn()
const mockGetActiveMembers = vi.fn()
const mockGetConsensusThreshold = vi.fn()
const mockGetTreasuryBalance = vi.fn()
const mockGetLoanPolicy = vi.fn()
const mockIsPaused = vi.fn()
const mockGetLoans = vi.fn()
const mockGetAdminLog = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/wallet', () => ({
  useWallet: () => ({
    address: 'GALICE',
    isConnected: true,
    connecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signXDR: vi.fn(),
  }),
}))

vi.mock('@/lib/stellar', async () => {
  const actual = await vi.importActual<typeof import('@/lib/stellar')>('@/lib/stellar')
  return { ...actual, isContractConfigured: () => true }
})

vi.mock('@/lib/dao-client', () => ({
  daoRead: {
    isMember: (...a: unknown[]) => mockIsMember(...a),
    isAdmin: (...a: unknown[]) => mockIsAdmin(...a),
    getMember: (...a: unknown[]) => mockGetMember(...a),
    getPendingYield: (...a: unknown[]) => mockGetPendingYield(...a),
    getAdmins: (...a: unknown[]) => mockGetAdmins(...a),
    getTotalMembers: (...a: unknown[]) => mockGetTotalMembers(...a),
    getActiveMembers: (...a: unknown[]) => mockGetActiveMembers(...a),
    getConsensusThreshold: (...a: unknown[]) => mockGetConsensusThreshold(...a),
    getTreasuryBalance: (...a: unknown[]) => mockGetTreasuryBalance(...a),
    getLoanPolicy: (...a: unknown[]) => mockGetLoanPolicy(...a),
    isPaused: (...a: unknown[]) => mockIsPaused(...a),
  },
  daoWrite: () => ({}),
  InvokeError: class InvokeError extends Error {},
  TransactionPendingError: class TransactionPendingError extends Error {},
  watchTransaction: vi.fn(),
}))

vi.mock('@/lib/backend', () => ({
  backend: {
    getLoans: (...a: unknown[]) => mockGetLoans(...a),
    getNotifications: vi.fn().mockResolvedValue([]),
    getEvents: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue(null),
    getAdminLog: (...a: unknown[]) => mockGetAdminLog(...a),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
  }),
  Toaster: () => null,
}))

describe('Admin Audit Log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsMember.mockResolvedValue(true)
    mockIsAdmin.mockResolvedValue(true)
    mockGetMember.mockResolvedValue({ status: 'ActiveMember', has_active_loan: false })
    mockGetPendingYield.mockResolvedValue(BigInt(0))
    mockGetAdmins.mockResolvedValue(['GADMIN'])
    mockGetTotalMembers.mockResolvedValue(10)
    mockGetActiveMembers.mockResolvedValue(8)
    mockGetConsensusThreshold.mockResolvedValue(5000)
    mockGetTreasuryBalance.mockResolvedValue(BigInt(0))
    mockGetLoanPolicy.mockResolvedValue({})
    mockIsPaused.mockResolvedValue(false)
    mockGetLoans.mockResolvedValue([])
  })
  afterEach(() => vi.clearAllMocks())

  async function openAuditTab() {
    renderWithProviders(<AdminPage />)
    await waitFor(() => expect(screen.getByText('Admin Dashboard')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /audit/i }))
    await waitFor(() => expect(screen.getByText('Audit Log')).toBeInTheDocument())
  }

  it('renders table with action, actor, target and time headers (th scope)', async () => {
    mockGetAdminLog.mockResolvedValue([
      { id: '1', action: 'Pause', actor: 'GADMIN', target: 'Protocol', timestamp: 1700000000 },
    ])

    await openAuditTab()

    expect(screen.getByRole('columnheader', { name: 'Action' })).toHaveAttribute('scope', 'col')
    expect(screen.getByRole('columnheader', { name: 'Actor' })).toHaveAttribute('scope', 'col')
    expect(screen.getByRole('columnheader', { name: 'Target' })).toHaveAttribute('scope', 'col')
    expect(screen.getByRole('columnheader', { name: 'Time' })).toHaveAttribute('scope', 'col')

    await waitFor(() => expect(screen.getByText('Pause')).toBeInTheDocument())
    expect(screen.getByText('GADMIN')).toBeInTheDocument()
    expect(screen.getByText('Protocol')).toBeInTheDocument()
  })

  it('renders empty state when audit log is empty', async () => {
    mockGetAdminLog.mockResolvedValue([])

    await openAuditTab()

    await waitFor(() => expect(screen.getByText('No audit log entries found.')).toBeInTheDocument())
  })

  it('renders error state when audit log fetch fails', async () => {
    mockGetAdminLog.mockRejectedValue(new Error('Network failure'))

    await openAuditTab()

    await waitFor(() => expect(screen.getByText(/Error: Network failure/)).toBeInTheDocument())
  })

  it('covers load-more functionality', async () => {
    const page1 = Array.from({ length: 10 }, (_, i) => ({
      id: String(i + 1),
      action: `Action ${i + 1}`,
      actor: 'GADMIN',
      target: 'Target',
      timestamp: 1700000000,
    }))
    const page2 = [
      { id: '11', action: 'Action 11', actor: 'GADMIN', target: 'Target', timestamp: 1700000000 },
    ]

    mockGetAdminLog.mockImplementation(async (page: number) => {
      if (page === 1) return page1
      if (page === 2) return page2
      return []
    })

    await openAuditTab()

    await waitFor(() => expect(screen.getByText('Action 10')).toBeInTheDocument())
    const loadMoreBtn = screen.getByRole('button', { name: 'Load More' })
    expect(loadMoreBtn).toBeInTheDocument()

    fireEvent.click(loadMoreBtn)

    await waitFor(() => expect(screen.getByText('Action 11')).toBeInTheDocument())
    expect(mockGetAdminLog).toHaveBeenCalledWith(2, 10)
  })
})
