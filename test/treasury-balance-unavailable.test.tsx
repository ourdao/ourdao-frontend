// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from './test-utils'
import TreasuryPage from '@/app/(app)/treasury/page'

// #656: a failed token balance read must not be shown or treated as a zero
// balance on the treasury stake form.

const { mockToken } = vi.hoisted(() => ({
  mockToken: {
    tokenId: 'CTOKEN',
    symbol: 'OUSD',
    decimals: 7,
    name: 'OurDAO USD',
    balance: BigInt(0),
    isLoading: false,
    isError: false,
    format: (value: bigint | string) => String(value),
    parse: (value: string) => BigInt(Math.round(Number(value) * 1e7)),
    hasSufficientBalance: () => true,
    refetch: vi.fn(),
  },
}))

vi.mock('@/hooks/useDAO', () => ({
  useUserData: () => ({ isConnected: true, isMember: true, pendingYield: BigInt(0) }),
  useDAOStats: () => ({
    treasuryBalance: BigInt(0),
    interestCollected: BigInt(0),
    principalLent: BigInt(0),
    principalRepaid: BigInt(0),
    totalRestaked: BigInt(0),
    valueDefaulted: BigInt(0),
    isPaused: false,
    isLoading: false,
  }),
  useStake: () => ({ stake: BigInt(0) }),
  useStaking: () => ({ stake: vi.fn(), unstake: vi.fn(), isPending: false }),
  useTreasuryProposals: () => ({
    proposals: [],
    isLoading: false,
    hasMore: false,
    loadMore: vi.fn(),
    isLoadingMore: false,
    hasErrors: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useTreasuryVoting: () => ({ voteOnTreasury: vi.fn(), isPending: false }),
  useHasVoted: () => ({ hasVoted: false }),
  useToken: () => mockToken,
  useVotingWeight: () => ({ votingWeight: 4, isLoading: false, isError: false, refetch: vi.fn() }),
}))

vi.mock('@/hooks/useProposalFilters', () => ({
  useProposalFilters: () => ({
    filteredItems: [],
    filters: {},
    setSearch: vi.fn(),
    setSort: vi.fn(),
    setStatus: vi.fn(),
  }),
}))

vi.mock('@/components/InterestHistory', () => ({
  InterestHistory: () => null,
}))

vi.mock('@/lib/useAnnounceLoad', () => ({
  useAnnounceLoad: () => undefined,
}))

describe('TreasuryPage stake form balance state (#656)', () => {
  beforeEach(() => {
    mockToken.isError = false
    mockToken.balance = BigInt(0)
    mockToken.refetch.mockReset()
  })

  it('shows "Balance unavailable" with a retry instead of a zero balance when the read fails', () => {
    mockToken.isError = true
    renderWithProviders(<TreasuryPage />)

    expect(screen.getByText('Balance unavailable.')).toBeInTheDocument()
    expect(screen.getByText('Balance: Unavailable')).toBeInTheDocument()
    expect(screen.queryByText(/Insufficient OUSD balance/)).not.toBeInTheDocument()
  })

  it('does not block staking on an unavailable balance', () => {
    mockToken.isError = true
    renderWithProviders(<TreasuryPage />)

    fireEvent.change(screen.getByLabelText(/Amount \(OUSD\)/), { target: { value: '5' } })

    expect(screen.queryByText('Insufficient Balance')).not.toBeInTheDocument()
  })

  it('retry control calls token.refetch()', () => {
    mockToken.isError = true
    renderWithProviders(<TreasuryPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(mockToken.refetch).toHaveBeenCalledTimes(1)
  })

  it('still reports insufficient balance when the read succeeds with a zero balance', () => {
    mockToken.isError = false
    mockToken.balance = BigInt(0)
    renderWithProviders(<TreasuryPage />)

    fireEvent.change(screen.getByLabelText(/Amount \(OUSD\)/), { target: { value: '5' } })

    expect(screen.getByText(/Insufficient OUSD balance/)).toBeInTheDocument()
    expect(screen.queryByText('Balance unavailable.')).not.toBeInTheDocument()
  })
})
