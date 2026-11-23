// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from './test-utils'
import GovernancePage from '@/app/(app)/governance/page'
import CreateProposalPage from '@/app/(app)/governance/create/page'

const mockIsMember = vi.fn()
const mockIsAdmin = vi.fn()
const mockGetMember = vi.fn()
const mockGetPendingYield = vi.fn()
const mockGetLoanProposal = vi.fn()
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
const mockProposeTreasuryWithdrawal = vi.fn()
const mockExpireLoanProposal = vi.fn()
const mockExpireTreasuryProposal = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => '/governance',
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
    getLoanProposal: (...a: unknown[]) => mockGetLoanProposal(...a),
    getTreasuryProposal: (...a: unknown[]) => mockGetTreasuryProposal(...a),
    getTotalMembers: (...a: unknown[]) => mockGetTotalMembers(...a),
    getActiveMembers: (...a: unknown[]) => mockGetActiveMembers(...a),
    getConsensusThreshold: (...a: unknown[]) => mockGetConsensusThreshold(...a),
    getTreasuryBalance: (...a: unknown[]) => mockGetTreasuryBalance(...a),
    getLoanPolicy: (...a: unknown[]) => mockGetLoanPolicy(...a),
    isPaused: (...a: unknown[]) => mockIsPaused(...a),
  },
  daoWrite: () => ({
    proposeTreasuryWithdrawal: (...a: unknown[]) => mockProposeTreasuryWithdrawal(...a),
    expireLoanProposal: (...a: unknown[]) => mockExpireLoanProposal(...a),
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

function resetDefaults() {
  vi.clearAllMocks()
  mockIsMember.mockResolvedValue(true)
  mockIsAdmin.mockResolvedValue(false)
  mockGetMember.mockResolvedValue({ status: 'ActiveMember', has_active_loan: false })
  mockGetPendingYield.mockResolvedValue(BigInt(0))
  mockGetTotalMembers.mockResolvedValue(10)
  mockGetActiveMembers.mockResolvedValue(8)
  mockGetConsensusThreshold.mockResolvedValue(5000)
  mockGetTreasuryBalance.mockResolvedValue(BigInt(0))
  mockGetLoanPolicy.mockResolvedValue({})
  mockIsPaused.mockResolvedValue(false)
  mockGetLoans.mockResolvedValue([])
  mockGetNotifications.mockResolvedValue([])
  mockGetEvents.mockResolvedValue([])
  mockGetStats.mockResolvedValue({ totalLoanProposals: 0, totalTreasuryProposals: 0 })
  mockProposeTreasuryWithdrawal.mockResolvedValue({ hash: 'tx', returnValue: null })
}

describe('GovernancePage', () => {
  beforeEach(resetDefaults)
  afterEach(() => vi.clearAllMocks())

  it('empty state: shows "No loan proposals yet" rather than fabricated rows', async () => {
    renderWithProviders(<GovernancePage />)
    await waitFor(() => expect(screen.getByText('No loan proposals yet.')).toBeInTheDocument())
  })

  it('populated state: renders a real loan proposal by id', async () => {
    mockGetStats.mockResolvedValue({ totalLoanProposals: 1, totalTreasuryProposals: 0 })
    mockGetLoanProposal.mockResolvedValue({
      id: 1,
      borrower: 'GBORROWER',
      amount: BigInt(1000_0000000),
      interest_rate: 500,
      status: 'Pending',
      phase: 'Voting',
      for_votes: 0,
      against_votes: 0,
      created_at: 1000,
      editing_period_end: 2000,
    })
    renderWithProviders(<GovernancePage />)

    await waitFor(() => expect(screen.getAllByText(/GBOR/).length).toBeGreaterThan(0))
    expect(screen.queryByText('No loan proposals yet.')).not.toBeInTheDocument()
  })
})

describe('finalize expired proposals (#612)', () => {
  const NOW_MS = Date.UTC(2026, 0, 1)
  const nowSec = Math.floor(NOW_MS / 1000)

  const loan = (editingEnd: number) => ({
    id: 3,
    borrower: 'GBORROWER',
    amount: BigInt(1000_0000000),
    interest_rate: 500,
    status: 'Pending',
    phase: 'Voting',
    for_votes: 0,
    against_votes: 0,
    created_at: 1000,
    editing_period_end: editingEnd,
    voting_period: 60,
  })

  const treasury = (createdAt: number, isPrivate = false) => ({
    id: 4,
    proposer: 'GPROPOSER',
    amount: BigInt(500_0000000),
    destination: 'GDESTINATION',
    status: 'Pending',
    reason: 'Pay a contractor',
    for_votes: 0,
    against_votes: 0,
    created_at: createdAt,
    voting_period: 60,
    private: isPrivate,
  })

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW_MS)
    resetDefaults()
    mockExpireLoanProposal.mockResolvedValue({ hash: 'tx-expire', returnValue: null })
    mockExpireTreasuryProposal.mockResolvedValue({ hash: 'tx-expire', returnValue: null })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function renderLoans(proposal: ReturnType<typeof loan>) {
    mockGetStats.mockResolvedValue({ totalLoanProposals: 1, totalTreasuryProposals: 0 })
    mockGetLoanProposal.mockResolvedValue(proposal)
    renderWithProviders(<GovernancePage />)
    await screen.findByText(/Loan Proposal #3/)
  }

  async function renderTreasury(proposal: ReturnType<typeof treasury>) {
    mockGetStats.mockResolvedValue({ totalLoanProposals: 0, totalTreasuryProposals: 1 })
    mockGetTreasuryProposal.mockResolvedValue(proposal)
    renderWithProviders(<GovernancePage />)
    await screen.findByText('Pay a contractor')
  }

  it('offers Finalize for a loan only after editing_period_end + voting_period', async () => {
    await renderLoans(loan(nowSec - 100))
    expect(screen.getByRole('button', { name: 'Finalize expired proposal' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Finalize expired proposal' }))
    await waitFor(() => expect(mockExpireLoanProposal).toHaveBeenCalledWith(3))
  })

  it('does not offer Finalize for a loan before the deadline', async () => {
    await renderLoans(loan(nowSec + 1000))
    expect(screen.queryByRole('button', { name: 'Finalize expired proposal' })).not.toBeInTheDocument()
    expect(mockExpireLoanProposal).not.toHaveBeenCalled()
  })

  it('does not offer Finalize while the DAO is paused', async () => {
    mockIsPaused.mockResolvedValue(true)
    await renderLoans(loan(nowSec - 100))
    expect(screen.queryByRole('button', { name: 'Finalize expired proposal' })).not.toBeInTheDocument()
  })

  it('offers Finalize for a treasury proposal only after created_at + voting_period', async () => {
    await renderTreasury(treasury(nowSec - 100))
    fireEvent.click(screen.getByRole('button', { name: 'Finalize expired proposal' }))
    await waitFor(() => expect(mockExpireTreasuryProposal).toHaveBeenCalledWith(4))
  })

  it('does not offer Finalize for a treasury proposal before its deadline', async () => {
    await renderTreasury(treasury(nowSec - 10))
    expect(screen.queryByRole('button', { name: 'Finalize expired proposal' })).not.toBeInTheDocument()
  })

  it('waits for the doubled window before offering Finalize on a private proposal', async () => {
    // One period has elapsed (contract expire() would succeed), but private
    // voting remains open for two periods.
    await renderTreasury(treasury(nowSec - 100, true))
    expect(screen.queryByRole('button', { name: 'Finalize expired proposal' })).not.toBeInTheDocument()

    // Rendering again past 2 * voting_period makes it available.
    vi.clearAllMocks()
    mockExpireTreasuryProposal.mockResolvedValue({ hash: 'tx-expire', returnValue: null })
    mockGetStats.mockResolvedValue({ totalLoanProposals: 0, totalTreasuryProposals: 1 })
    mockGetTreasuryProposal.mockResolvedValue(treasury(nowSec - 200, true))
    renderWithProviders(<GovernancePage />)
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Finalize expired proposal' }).length).toBeGreaterThan(0),
    )
  })
})

describe('CreateProposalPage', () => {
  beforeEach(resetDefaults)
  afterEach(() => vi.clearAllMocks())

  it('renders the treasury proposal form for a connected member', async () => {
    renderWithProviders(<CreateProposalPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Proposal' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Create Proposal/ })).toBeInTheDocument()
  })

  it('rejects a submission with an invalid destination address instead of calling the contract', async () => {
    renderWithProviders(<CreateProposalPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Proposal' })).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '100' } })
    fireEvent.change(screen.getByPlaceholderText('G… or C…'), { target: { value: 'not-a-valid-address' } })
    fireEvent.change(screen.getByPlaceholderText(/Explain what this withdrawal is for/), {
      target: { value: 'Pay a contractor' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Create Proposal/ }))

    expect(mockProposeTreasuryWithdrawal).not.toHaveBeenCalled()
  })
})
