// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { renderWithProviders } from './test-utils'
import TreasuryProposalDetailPage from '@/app/(app)/treasury/[id]/page'
import * as utils from '@/lib/utils'

const mockGetTreasuryProposal = vi.fn()
const mockHasVoted = vi.fn()
const mockIsMember = vi.fn()
const mockExecuteTreasury = vi.fn()
const mockCancelTreasury = vi.fn()
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
    getToken: vi.fn().mockResolvedValue('CTOKEN'),
    getTotalMembers: vi.fn().mockResolvedValue(10),
    getActiveMembers: vi.fn().mockResolvedValue(8),
    getConsensusThreshold: vi.fn().mockResolvedValue(5100),
    getTreasuryBalance: vi.fn().mockResolvedValue(BigInt(1000000000)),
    isPaused: vi.fn().mockResolvedValue(false),
  },
  tokenRead: {
    getSymbol: vi.fn().mockResolvedValue('OUSD'),
    getDecimals: vi.fn().mockResolvedValue(7),
    getName: vi.fn().mockResolvedValue('OurDAO USD'),
    getBalance: vi.fn().mockResolvedValue(BigInt(0)),
  },
  daoWrite: () => ({
    voteOnTreasuryProposal: (...a: unknown[]) => mockVoteOnTreasury(...a),
    executeTreasuryProposal: (...a: unknown[]) => mockExecuteTreasury(...a),
    cancelTreasuryProposal: (...a: unknown[]) => mockCancelTreasury(...a),
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
    vi.spyOn(window, 'confirm').mockReturnValue(true)
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

    expect(await screen.findByText('5 OUSD')).toBeInTheDocument() // 50000000 stroops = 5 tokens
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

    it('disables Execute and names InsufficientTreasury when the treasury is short', async () => {
      mockGetTreasuryProposal.mockResolvedValue({ ...awaiting, amount: '2000000000' })

      renderWithProviders(<TreasuryProposalDetailPage />)

      const button = await screen.findByRole('button', { name: /^Execute$/ })
      expect(button).toBeDisabled()
      expect(screen.getByText(/InsufficientTreasury/)).toBeInTheDocument()
      fireEvent.click(button)
      expect(mockExecuteTreasury).not.toHaveBeenCalled()
    })
  })

  describe('cancel treasury proposal (#609)', () => {
    const editable = {
      id: 42,
      proposer: 'GALICE',
      destination: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      reason: 'Pay a contractor',
      amount: '50000000',
      status: 'Pending',
      votesFor: '0',
      votesAgainst: '0',
      isPrivate: false,
      created_at: Math.floor(Date.now() / 1000) - 10,
    }

    it('offers Cancel to the proposer inside the editing window', async () => {
      mockGetTreasuryProposal.mockResolvedValue(editable)
      mockCancelTreasury.mockResolvedValue({ hash: 'tx-cancel', returnValue: null })

      renderWithProviders(<TreasuryProposalDetailPage />)

      fireEvent.click(await screen.findByRole('button', { name: 'Cancel treasury proposal' }))

      const dialog = await screen.findByRole('dialog', { name: 'Cancel this treasury proposal?' })
      expect(dialog).toHaveTextContent('cannot be undone')
      expect(window.confirm).not.toHaveBeenCalled()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm cancellation' }))

      await waitFor(() => expect(mockCancelTreasury).toHaveBeenCalledWith(42))
    })

    it('hides Cancel from a different wallet', async () => {
      mockGetTreasuryProposal.mockResolvedValue({ ...editable, proposer: 'GBOB' })

      renderWithProviders(<TreasuryProposalDetailPage />)
      await screen.findByText(/Proposal Details/)

      expect(screen.queryByRole('button', { name: 'Cancel treasury proposal' })).not.toBeInTheDocument()
    })
  })

  describe('private commit-reveal salt backup (#546)', () => {
    // Raw contract shape (see treasuryProposalSchema): the mapper reads
    // `private`, `for_votes`, `against_votes`, not the UI field names.
    const privateProposal = {
      id: 42,
      proposer: 'GPROPOSER',
      destination: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      reason: 'Treasury Proposal #42',
      amount: '50000000',
      status: 'Pending',
      for_votes: '0',
      against_votes: '0',
      created_at: 0,
      private: true,
    }

    beforeEach(() => {
      localStorage.clear()
    })

    // #519: the commit transaction must not be sendable until the salt backup
    // has been downloaded.
    it('keeps the commit button disabled until the salt backup is downloaded', async () => {
      const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:salt-backup')
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      mockGetTreasuryProposal.mockResolvedValue(privateProposal)
      mockHasVoted.mockResolvedValue(false)

      renderWithProviders(<TreasuryProposalDetailPage />)

      fireEvent.click(await screen.findByRole('button', { name: /Commit FOR/i }))

      const commitButton = await screen.findByRole('button', { name: /Step 2: Commit Vote/i })
      expect(commitButton).toBeDisabled()

      fireEvent.click(screen.getByRole('button', { name: /Step 1: Download salt backup/i }))

      await waitFor(() => expect(screen.getByRole('button', { name: /Step 2: Commit Vote/i })).toBeEnabled())
      expect(createObjectURL).toHaveBeenCalledTimes(1)
    })

    // #518: a member whose local salt is missing must still be able to import
    // the backup and reach the reveal buttons.
    it('offers a salt import when the vote is committed but no salt is stored, and reveals after import', async () => {
      mockGetTreasuryProposal.mockResolvedValue(privateProposal)
      mockHasVoted.mockResolvedValue(true)

      renderWithProviders(<TreasuryProposalDetailPage />)

      await screen.findByText(/salt not found/i)
      expect(screen.queryByRole('button', { name: /Reveal FOR/i })).not.toBeInTheDocument()

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(input).not.toBeNull()
      const backup = JSON.stringify({ proposalId: 42, address: 'GALICE', salt: '00'.repeat(32) })
      const file = new File([backup], 'salt.json', { type: 'application/json' })
      fireEvent.change(input, { target: { files: [file] } })

      expect(await screen.findByRole('button', { name: /Reveal FOR/i })).toBeInTheDocument()
    })

    it('backs up the exact salt used to compute the on-chain commitment and calls generateCommitment once', async () => {
      mockGetTreasuryProposal.mockResolvedValue(privateProposal)

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
        fireEvent.click(await screen.findByRole('button', { name: /Step 1: Download salt backup/i }))
        fireEvent.click(await screen.findByRole('button', { name: /Step 2: Commit Vote/i }))

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
