// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from './test-utils'
import TreasuryPage from '@/app/(app)/treasury/page'

const mockIsMember = vi.fn()
const mockIsAdmin = vi.fn()
const mockGetMember = vi.fn()
const mockGetPendingYield = vi.fn()
const mockGetStake = vi.fn()
const mockGetTreasuryProposal = vi.fn()
const mockGetTotalMembers = vi.fn()
const mockGetActiveMembers = vi.fn()
const mockGetConsensusThreshold = vi.fn()
const mockGetTreasuryBalance = vi.fn()
const mockGetLoanPolicy = vi.fn()
const mockIsPaused = vi.fn()
const mockGetLoans = vi.fn()
const mockGetNotifications = vi.fn()
const mockGetEvents = vi.fn()
const mockGetStats = vi.fn()
const mockExpireTreasuryProposal = vi.fn()
const mockNow = vi.hoisted(() => {
  let value: number | null = null
  const listeners = new Set<() => void>()
  return {
    get value() {
      return value
    },
    set(next: number | null) {
      value = next
      listeners.forEach((listener) => listener())
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot() {
      return value
    },
  }
})

vi.mock('@/hooks/useNow', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    useNow: () =>
      React.useSyncExternalStore(mockNow.subscribe, mockNow.getSnapshot, () => null),
  }
})

vi.mock('next/navigation', () => ({
  usePathname: () => '/treasury',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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
    getStake: (...a: unknown[]) => mockGetStake(...a),
    getToken: vi.fn().mockResolvedValue('CTOKEN'),
    getTreasuryProposal: (...a: unknown[]) => mockGetTreasuryProposal(...a),
    getTotalMembers: (...a: unknown[]) => mockGetTotalMembers(...a),
    getActiveMembers: (...a: unknown[]) => mockGetActiveMembers(...a),
    getConsensusThreshold: (...a: unknown[]) => mockGetConsensusThreshold(...a),
    getTreasuryBalance: (...a: unknown[]) => mockGetTreasuryBalance(...a),
    getLoanPolicy: (...a: unknown[]) => mockGetLoanPolicy(...a),
    isPaused: (...a: unknown[]) => mockIsPaused(...a),
  },
  tokenRead: {
    getSymbol: vi.fn().mockResolvedValue('OUSD'),
    getDecimals: vi.fn().mockResolvedValue(7),
    getName: vi.fn().mockResolvedValue('OurDAO USD'),
    getBalance: vi.fn().mockResolvedValue(BigInt(0)),
  },
  daoWrite: () => ({
    stake: vi.fn(),
    unstake: vi.fn(),
    expireTreasuryProposal: (...a: unknown[]) => mockExpireTreasuryProposal(...a),
  }),
}))

vi.mock('@/lib/backend', () => ({
  backend: {
    getLoans: (...a: unknown[]) => mockGetLoans(...a),
    getNotifications: (...a: unknown[]) => mockGetNotifications(...a),
    getEvents: (...a: unknown[]) => mockGetEvents(...a),
    getStats: (...a: unknown[]) => mockGetStats(...a),
    getAdminLog: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
  },
}))

describe('TreasuryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNow.set(null)
    mockIsMember.mockResolvedValue(true)
    mockIsAdmin.mockResolvedValue(false)
    mockGetMember.mockResolvedValue({ status: 'ActiveMember', has_active_loan: false })
    mockGetPendingYield.mockResolvedValue(BigInt(0))
    mockGetStake.mockResolvedValue(BigInt(50_0000000))
    mockGetTotalMembers.mockResolvedValue(10)
    mockGetActiveMembers.mockResolvedValue(8)
    mockGetConsensusThreshold.mockResolvedValue(5000)
    mockGetTreasuryBalance.mockResolvedValue(BigInt(900_0000000))
    mockGetLoanPolicy.mockResolvedValue({})
    mockIsPaused.mockResolvedValue(false)
    mockGetLoans.mockResolvedValue([])
    mockGetNotifications.mockResolvedValue([])
    mockGetEvents.mockResolvedValue([])
    mockGetStats.mockResolvedValue({ totalTreasuryProposals: 0 })
    mockExpireTreasuryProposal.mockResolvedValue({ hash: 'tx-expire', returnValue: null })
  })
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it("renders the real treasury balance and the connected member's own stake", async () => {
    renderWithProviders(<TreasuryPage />)

    await waitFor(() => expect(screen.getByText('900 OUSD')).toBeInTheDocument())
    expect(await screen.findByText('50 OUSD')).toBeInTheDocument()
  })

  it('displays voting weight preview based on stake', async () => {
    renderWithProviders(<TreasuryPage />)

    await waitFor(() => {
      expect(screen.getByText('Current Voting Weight')).toBeInTheDocument()
    })
    expect(screen.getByText('Projected Weight (after stake)')).toBeInTheDocument()
  })

  describe('finalizing expired treasury proposals (#612)', () => {
    const nowSeconds = 1_700_000_000

    const rawProposal = (overrides: Record<string, unknown> = {}) => ({
      id: 7,
      proposer: 'GALICE',
      destination: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      reason: 'Treasury Proposal #7',
      amount: '10000000',
      status: 'Pending',
      for_votes: '0',
      against_votes: '0',
      created_at: nowSeconds - 100,
      voting_period: 1000,
      private: false,
      ...overrides,
    })

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      vi.setSystemTime(nowSeconds * 1000)
      mockNow.set(nowSeconds * 1000)
      mockGetStats.mockResolvedValue({ totalTreasuryProposals: 1 })
    })

    it('hides Finalize until the voting window has passed, then offers it', async () => {
      mockGetTreasuryProposal.mockResolvedValue(rawProposal())
      renderWithProviders(<TreasuryPage />)

      await screen.findByText('Treasury Proposal #7')
      expect(screen.queryByRole('button', { name: 'Finalize' })).not.toBeInTheDocument()

      await act(async () => {
        mockNow.set(nowSeconds * 1000 + 901_000)
      })

      expect(await screen.findByRole('button', { name: 'Finalize' })).toBeInTheDocument()
    })

    it('doubles the voting window for private treasury proposals', async () => {
      mockGetTreasuryProposal.mockResolvedValue(rawProposal({ private: true }))
      renderWithProviders(<TreasuryPage />)

      await screen.findByText('Treasury Proposal #7')
      await act(async () => {
        mockNow.set(nowSeconds * 1000 + 901_000)
      })
      expect(screen.queryByRole('button', { name: 'Finalize' })).not.toBeInTheDocument()

      await act(async () => {
        mockNow.set(nowSeconds * 1000 + 1_901_000)
      })
      expect(await screen.findByRole('button', { name: 'Finalize' })).toBeInTheDocument()
    })

    it('calls expire_treasury_proposal when Finalize is clicked', async () => {
      mockGetTreasuryProposal.mockResolvedValue(rawProposal({ voting_period: 50 }))
      renderWithProviders(<TreasuryPage />)

      fireEvent.click(await screen.findByRole('button', { name: 'Finalize' }))

      await waitFor(() => expect(mockExpireTreasuryProposal).toHaveBeenCalledWith(7))
    })

    it('hides Finalize once the proposal is already expired', async () => {
      mockGetTreasuryProposal.mockResolvedValue(
        rawProposal({ status: 'Expired', voting_period: 100 })
      )
      renderWithProviders(<TreasuryPage />)

      await screen.findByText('Treasury Proposal #7')
      expect(screen.queryByRole('button', { name: 'Finalize' })).not.toBeInTheDocument()
    })

    it('disables Finalize while the DAO is paused', async () => {
      mockIsPaused.mockResolvedValue(true)
      mockGetTreasuryProposal.mockResolvedValue(rawProposal({ voting_period: 50 }))
      renderWithProviders(<TreasuryPage />)

      expect(await screen.findByRole('button', { name: 'Finalize' })).toBeDisabled()
    })
  })
})
