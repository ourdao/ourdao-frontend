// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from './test-utils'
import TreasuryProposalDetailPage from '@/app/(app)/treasury/[id]/page'
import * as utils from '@/lib/utils'

const mockGetTreasuryProposal = vi.fn()
const mockHasVoted = vi.fn()
const mockIsMember = vi.fn()
const mockExecuteTreasury = vi.fn()
const mockCommitTreasuryVote = vi.fn().mockResolvedValue({ hash: 'tx-commit', returnValue: null })
const mockAnnounce = vi.fn()

vi.mock('@/lib/announce', () => ({
  announce: (...a: unknown[]) => mockAnnounce(...a),
}))
const mockVoteOnTreasury = vi.fn().mockResolvedValue({ hash: 'tx-vote-treasury', returnValue: null })

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '42' }),
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
    isAdmin: vi.fn().mockResolvedValue(false),
    getMember: vi.fn().mockResolvedValue(null),
    getPendingYield: vi.fn().mockResolvedValue(BigInt(0)),
    calculateExitShare: vi.fn().mockResolvedValue(null),
    getTreasuryProposal: (...a: unknown[]) => mockGetTreasuryProposal(...a),
    hasVoted: (...a: unknown[]) => mockHasVoted(...a),
    getDocument: vi.fn().mockResolvedValue(null),
    getTotalMembers: vi.fn().mockResolvedValue(10),
    getActiveMembers: vi.fn().mockResolvedValue(8),
    getConsensusThreshold: vi.fn().mockResolvedValue(5100),
    getTreasuryBalance: vi.fn().mockResolvedValue(BigInt(1000000000)),
    isPaused: vi.fn().mockResolvedValue(false),
  },
  daoWrite: () => ({
    voteOnTreasuryProposal: (...a: unknown[]) => mockVoteOnTreasury(...a),
    executeTreasuryProposal: (...a: unknown[]) => mockExecuteTreasury(...a),
    commitTreasuryVote: (...a: unknown[]) => mockCommitTreasuryVote(...a),
  }),
  InvokeError: class InvokeError extends Error {
    retryable = false
    constructor(m: string) {
      super(m)
      this.name = 'InvokeError'
    }
  },
  // useWriteAction's catch block does `instanceof TransactionPendingError`.
  TransactionPendingError: class TransactionPendingError extends Error {},
  watchTransaction: vi.fn(),
}))

describe('TreasuryProposalDetailPage (/treasury/[id])', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsMember.mockResolvedValue(true)
    mockHasVoted.mockResolvedValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders treasury proposal details when loaded', async () => {
    mockGetTreasuryProposal.mockResolvedValue({
      id: 42,
      destination: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      reason: 'Treasury Proposal #42',
      amount: '50000000',
      status: 'Pending', // In Voting
      votesFor: '10',
      votesAgainst: '2',
      isPrivate: false,
    })

    renderWithProviders(<TreasuryProposalDetailPage />)

    await waitFor(() => {
      expect(screen.getAllByText(/Treasury Proposal #42/)[0]).toBeInTheDocument()
    })

    expect(screen.getByText('5 TOKEN')).toBeInTheDocument() // 50000000 stroops = 5 TOKEN
    expect(screen.getByText(/GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5/)).toBeInTheDocument()
    expect(screen.getByText('In Voting')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Vote For/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Vote Against/i })).toBeInTheDocument()
  })

  it('allows voting on an active proposal and calls voteOnTreasuryProposal', async () => {
    mockGetTreasuryProposal.mockResolvedValue({
      id: 42,
      destination: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      reason: 'Treasury Proposal #42',
      amount: '50000000',
      status: 'Pending',
      votesFor: '10',
      votesAgainst: '2',
      isPrivate: false,
    })

    renderWithProviders(<TreasuryProposalDetailPage />)

    const voteForBtn = await screen.findByRole('button', { name: /Vote For/i })
    fireEvent.click(voteForBtn)

    await waitFor(() => {
      expect(mockVoteOnTreasury).toHaveBeenCalledWith(42, true)
    })
  })

  it('renders not found state when proposal read fails or returns null', async () => {
    mockGetTreasuryProposal.mockResolvedValue(null)

    renderWithProviders(<TreasuryProposalDetailPage />)

    await waitFor(() => {
      expect(screen.getByText(/Treasury Proposal Not Found/i)).toBeInTheDocument()
    })
  })

  describe('awaiting funds (#540)', () => {
    const awaiting = {
      id: 42,
      destination: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      reason: 'Treasury Proposal #42',
      amount: '50000000',
      status: 'ApprovedPendingDisbursement',
      votesFor: '10',
      votesAgainst: '2',
      isPrivate: false,
    }

    it('offers Execute to a member and calls execute_treasury_proposal', async () => {
      mockGetTreasuryProposal.mockResolvedValue(awaiting)
      mockExecuteTreasury.mockResolvedValue({ hash: 'tx-exec', returnValue: null })

      renderWithProviders(<TreasuryProposalDetailPage />)

      fireEvent.click(await screen.findByRole('button', { name: /^Execute$/ }))

      await waitFor(() => expect(mockExecuteTreasury).toHaveBeenCalledWith(42))
    })

    it('refetches the proposal after a successful execution', async () => {
      mockGetTreasuryProposal.mockResolvedValue(awaiting)
      mockExecuteTreasury.mockResolvedValue({ hash: 'tx-exec', returnValue: null })

      renderWithProviders(<TreasuryProposalDetailPage />)
      await screen.findByRole('button', { name: /^Execute$/ })
      const before = mockGetTreasuryProposal.mock.calls.length

      fireEvent.click(screen.getByRole('button', { name: /^Execute$/ }))

      await waitFor(() =>
        expect(mockGetTreasuryProposal.mock.calls.length).toBeGreaterThan(before),
      )
    })

    it('surfaces the contract error in plain language when execution fails', async () => {
      mockGetTreasuryProposal.mockResolvedValue(awaiting)
      mockExecuteTreasury.mockRejectedValue(
        new Error('The treasury balance is too low to cover this payout. Top up the treasury, then try again.'),
      )
      renderWithProviders(<TreasuryProposalDetailPage />)
      fireEvent.click(await screen.findByRole('button', { name: /^Execute$/ }))

      await waitFor(() =>
        expect(mockAnnounce).toHaveBeenCalledWith(
          expect.stringContaining('treasury balance is too low'),
          'assertive',
        ),
      )
      // The action stays available so the member can retry after a top-up.
      expect(screen.getByRole('button', { name: /^Execute$/ })).toBeEnabled()
    })

    it('hides Execute when the proposal is not awaiting funds', async () => {
      mockGetTreasuryProposal.mockResolvedValue({ ...awaiting, status: 'Pending' })

      renderWithProviders(<TreasuryProposalDetailPage />)
      await screen.findByRole('button', { name: /Vote For/i })

      expect(screen.queryByRole('button', { name: /^Execute$/ })).not.toBeInTheDocument()
    })

    it('hides Execute from a wallet that is not a member', async () => {
      mockIsMember.mockResolvedValue(false)
      mockGetTreasuryProposal.mockResolvedValue(awaiting)

      renderWithProviders(<TreasuryProposalDetailPage />)
      await screen.findByText(/awaiting treasury funds/i)

      expect(screen.queryByRole('button', { name: /^Execute$/ })).not.toBeInTheDocument()
    })
  })

  describe('private commit-reveal salt backup (#546)', () => {
    it('backs up the exact salt used to compute the on-chain commitment and calls generateCommitment once', async () => {
      mockGetTreasuryProposal.mockResolvedValue({
        id: 42,
        destination: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        reason: 'Private Treasury Proposal #42',
        amount: '50000000',
        status: 'Pending',
        votesFor: '0',
        votesAgainst: '0',
        private: true,
      })

      const generateCommitmentSpy = vi.spyOn(utils, 'generateCommitment')
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      let capturedBlob: Blob | null = null
      const origCreateObjectURL = URL.createObjectURL
      const origRevokeObjectURL = URL.revokeObjectURL
      URL.createObjectURL = vi.fn((blob: Blob) => {
        capturedBlob = blob
        return 'blob:salt-backup'
      })
      URL.revokeObjectURL = vi.fn()

      try {
        renderWithProviders(<TreasuryProposalDetailPage />)

        fireEvent.click(await screen.findByRole('button', { name: /Commit FOR/i }))
        fireEvent.click(await screen.findByRole('button', { name: /Commit Vote & Download Salt/i }))

        await waitFor(() => {
          expect(mockCommitTreasuryVote).toHaveBeenCalledTimes(1)
        })

        expect(generateCommitmentSpy).toHaveBeenCalledTimes(1)
        expect(capturedBlob).not.toBeNull()

        const [calledProposalId, committedHash] = mockCommitTreasuryVote.mock.calls[0] as [
          number,
          Uint8Array,
        ]
        expect(calledProposalId).toBe(42)

        const backupJson = JSON.parse(await capturedBlob!.text()) as {
          proposalId: number
          address: string
          salt: string
        }
        expect(backupJson.proposalId).toBe(42)
        expect(backupJson.address).toBe('GALICE')

        const backedUpSalt = new Uint8Array(
          (backupJson.salt.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16)),
        )
        expect(backedUpSalt).toHaveLength(32)

        const preimage = new Uint8Array(33)
        preimage[0] = 1 // FOR
        preimage.set(backedUpSalt, 1)
        const expectedCommitment = new Uint8Array(await crypto.subtle.digest('SHA-256', preimage))

        expect(Array.from(committedHash)).toEqual(Array.from(expectedCommitment))
      } finally {
        URL.createObjectURL = origCreateObjectURL
        URL.revokeObjectURL = origRevokeObjectURL
      }
    })
  })
})
