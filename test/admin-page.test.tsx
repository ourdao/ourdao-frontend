// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import toast from 'react-hot-toast'
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
const mockGetFailedEvents = vi.fn()
const mockReEvaluateFailedEvent = vi.fn()
const mockBatchResolveFailedEvents = vi.fn()
const mockAddAdmin = vi.fn()
const mockSetThreshold = vi.fn()
const mockPause = vi.fn()

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
    signMessage: vi.fn(async () => 'signature'),
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
  daoWrite: () => ({
    pause: mockPause,
    unpause: vi.fn(),
    addAdmin: mockAddAdmin,
    removeAdmin: vi.fn(),
    setConsensusThreshold: mockSetThreshold,
  }),
  // useWriteAction's failure path branches on these.
  InvokeError: class InvokeError extends Error {
    retryable = false
  },
  TransactionPendingError: class TransactionPendingError extends Error {},
  watchTransaction: vi.fn(),
}))

vi.mock('@/lib/backend', () => ({
  MAX_FAILED_EVENTS_PER_BATCH: 500,
  backend: {
    getLoans: (...a: unknown[]) => mockGetLoans(...a),
    getNotifications: vi.fn().mockResolvedValue([]),
    getEvents: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue(null),
    getAdminLog: (...a: unknown[]) => mockGetAdminLog(...a),
    getFailedEvents: (...a: unknown[]) => mockGetFailedEvents(...a),
    reEvaluateFailedEvent: (...a: unknown[]) => mockReEvaluateFailedEvent(...a),
    batchResolveFailedEvents: (...a: unknown[]) => mockBatchResolveFailedEvents(...a),
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

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    mockGetAdminLog.mockResolvedValue([])
    mockGetFailedEvents.mockResolvedValue([])
    mockReEvaluateFailedEvent.mockResolvedValue({ eventId: 12, status: 'resolved' })
    mockBatchResolveFailedEvents.mockResolvedValue({ resolved: 2 })
  })
  afterEach(() => vi.clearAllMocks())

  it('refuses a non-admin member: shows Access Denied, not the admin controls', async () => {
    mockIsMember.mockResolvedValue(true)
    mockIsAdmin.mockResolvedValue(false)
    renderWithProviders(<AdminPage />)

    await waitFor(() => expect(screen.getByText('Access Denied')).toBeInTheDocument())
    expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Governance/ })).not.toBeInTheDocument()
  })

  it('renders the admin dashboard for an actual admin', async () => {
    mockIsMember.mockResolvedValue(true)
    mockIsAdmin.mockResolvedValue(true)
    renderWithProviders(<AdminPage />)

    await waitFor(() => expect(screen.getByText('Admin Dashboard')).toBeInTheDocument())
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Governance/ })).toBeInTheDocument()
  })

  it('demonstrates the gate actually gates: flipping isAdmin from true to false changes the outcome', async () => {
    mockIsMember.mockResolvedValue(true)
    mockIsAdmin.mockResolvedValue(true)
    const { unmount } = renderWithProviders(<AdminPage />)
    await waitFor(() => expect(screen.getByText('Admin Dashboard')).toBeInTheDocument())
    unmount()

    mockIsAdmin.mockResolvedValue(false)
    renderWithProviders(<AdminPage />)
    await waitFor(() => expect(screen.getByText('Access Denied')).toBeInTheDocument())
  })

  // ── add-admin address validation (#66) ────────────────────────────────
  describe('add-admin field', () => {
    async function openGovernanceTab() {
      mockIsMember.mockResolvedValue(true)
      mockIsAdmin.mockResolvedValue(true)
      renderWithProviders(<AdminPage />)
      await waitFor(() => expect(screen.getByText('Admin Dashboard')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: /Governance/ }))
      await waitFor(() =>
        expect(screen.getByPlaceholderText('G… address to add as admin')).toBeInTheDocument()
      )
    }

    it('disables Add Admin and shows an error for a malformed address, without calling addAdmin', async () => {
      await openGovernanceTab()

      const input = screen.getByPlaceholderText('G… address to add as admin')
      fireEvent.change(input, { target: { value: 'not-a-valid-address' } })

      const submit = screen.getByRole('button', { name: 'Add Admin' })
      expect(submit).toBeDisabled()
      expect(
        screen.getByText('Enter a valid Stellar destination address (G… or C…)')
      ).toBeInTheDocument()

      fireEvent.click(submit)
      expect(mockAddAdmin).not.toHaveBeenCalled()
    })

    it('rejects an address containing non-base32 characters (0, 1, 8, 9), matching isStellarAddress', async () => {
      await openGovernanceTab()

      // Same shape/length as a real address, with a non-base32 digit swapped
      // in — the exact case the old [A-Z0-9] regex wrongly admitted.
      const invalid = 'GAHJJJKMOKYE0RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3MQAXRWUDX'
      fireEvent.change(screen.getByPlaceholderText('G… address to add as admin'), {
        target: { value: invalid },
      })

      expect(screen.getByRole('button', { name: 'Add Admin' })).toBeDisabled()
    })

    it('enables Add Admin once a well-formed address is entered', async () => {
      await openGovernanceTab()

      const input = screen.getByPlaceholderText('G… address to add as admin')
      fireEvent.change(input, { target: { value: 'not-a-valid-address' } })
      expect(screen.getByRole('button', { name: 'Add Admin' })).toBeDisabled()

      fireEvent.change(input, {
        target: { value: 'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3MQAXRWUDX' },
      })

      expect(
        screen.queryByText('Enter a valid Stellar destination address (G… or C…)')
      ).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add Admin' })).not.toBeDisabled()
    })
  })

  // ── failed admin writes (#316) ────────────────────────────────────────
  describe('failed admin writes', () => {
    const VALID = 'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3MQAXRWUDX'
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)

    beforeEach(() => {
      unhandled.length = 0
      process.on('unhandledRejection', onUnhandled)
      vi.spyOn(window, 'confirm').mockReturnValue(true)
    })
    afterEach(() => {
      process.off('unhandledRejection', onUnhandled)
      vi.restoreAllMocks()
    })

    async function openGovernanceTab() {
      mockIsMember.mockResolvedValue(true)
      mockIsAdmin.mockResolvedValue(true)
      renderWithProviders(<AdminPage />)
      await waitFor(() => expect(screen.getByText('Admin Dashboard')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: /Governance/ }))
      await waitFor(() =>
        expect(screen.getByPlaceholderText('G… address to add as admin')).toBeInTheDocument()
      )
    }

    // Lets any rejected promise the handler leaked reach the process hook.
    const settle = () => new Promise((r) => setTimeout(r, 50))

    it('a rejected addAdmin shows one error toast, keeps the input, and leaks no rejection', async () => {
      mockAddAdmin.mockRejectedValue(new Error('User declined'))
      await openGovernanceTab()

      const input = screen.getByPlaceholderText('G… address to add as admin')
      fireEvent.change(input, { target: { value: VALID } })
      fireEvent.click(screen.getByRole('button', { name: 'Add Admin' }))

      await waitFor(() => expect(mockAddAdmin).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
      await settle()
      expect(unhandled).toEqual([])
      // Not cleared: the member can correct and retry.
      expect(input).toHaveValue(VALID)
    })

    it('a rejected setThreshold shows one error toast and leaks no rejection', async () => {
      mockSetThreshold.mockRejectedValue(new Error('User declined'))
      await openGovernanceTab()

      fireEvent.change(screen.getByPlaceholderText('e.g. 5100 for 51%'), {
        target: { value: '5100' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Update Threshold' }))

      await waitFor(() => expect(mockSetThreshold).toHaveBeenCalledWith(5100))
      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
      await settle()
      expect(unhandled).toEqual([])
    })

    it('rejects a non-integer threshold before any signing', async () => {
      await openGovernanceTab()

      fireEvent.change(screen.getByPlaceholderText('e.g. 5100 for 51%'), {
        target: { value: '5100.5' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Update Threshold' }))
      await settle()

      expect(mockSetThreshold).not.toHaveBeenCalled()
      expect(window.confirm).not.toHaveBeenCalled()
    })

    it('a rejected pause shows one error toast and leaks no rejection', async () => {
      mockPause.mockRejectedValue(new Error('User declined'))
      mockIsMember.mockResolvedValue(true)
      mockIsAdmin.mockResolvedValue(true)
      renderWithProviders(<AdminPage />)
      await waitFor(() => expect(screen.getByText('Admin Dashboard')).toBeInTheDocument())

      fireEvent.click(screen.getByRole('button', { name: /^Pause/ }))

      await waitFor(() => expect(mockPause).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
      await settle()
      expect(unhandled).toEqual([])
    })
  })

  // ── quarantined event actions (#637, #638, #639) ────────────────────────
  describe('quarantined events', () => {
    const event = (id: number) => ({
      id,
      ledger: 42,
      symbol: 'loan_req',
      error: 'handler failed',
      retry_count: 1,
      created_at: '2026-01-01T00:00:00Z',
    })

    beforeEach(() => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      mockIsMember.mockResolvedValue(true)
      mockIsAdmin.mockResolvedValue(true)
    })
    afterEach(() => vi.restoreAllMocks())

    async function openQuarantineTab() {
      renderWithProviders(<AdminPage />)
      await waitFor(() => expect(screen.getByText('Admin Dashboard')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: /Quarantined Events/ }))
      await waitFor(() => expect(screen.getByText('Quarantined / Failed Events')).toBeInTheDocument())
      await waitFor(() =>
        expect(screen.queryByText('Loading quarantined events…')).not.toBeInTheDocument()
      )
    }

    it('re-evaluates one event and shows still_failing as an outcome, not an error toast', async () => {
      mockGetFailedEvents.mockResolvedValue([event(12)])
      mockReEvaluateFailedEvent.mockResolvedValue({ eventId: 12, status: 'still_failing' })
      await openQuarantineTab()

      fireEvent.click(screen.getByRole('button', { name: 'Re-evaluate event 12' }))

      await waitFor(() =>
        expect(mockReEvaluateFailedEvent).toHaveBeenCalledWith(
          12,
          expect.objectContaining({ address: 'GALICE' })
        )
      )
      expect(await screen.findByText('Still failing')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('shows a real re-evaluation failure inline', async () => {
      mockGetFailedEvents.mockResolvedValue([event(12)])
      mockReEvaluateFailedEvent.mockRejectedValue(new Error('Backend responded 401'))
      await openQuarantineTab()

      fireEvent.click(screen.getByRole('button', { name: 'Re-evaluate event 12' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Backend responded 401')
      expect(screen.queryByText('Still failing')).not.toBeInTheDocument()
    })

    it('selects all rows, confirms, and submits their ids in one request', async () => {
      mockGetFailedEvents.mockResolvedValue([event(12), event(13)])
      await openQuarantineTab()

      fireEvent.click(screen.getByLabelText('Select all'))
      expect(screen.getByLabelText('Select event 12')).toBeChecked()
      expect(screen.getByLabelText('Select event 13')).toBeChecked()
      fireEvent.click(screen.getByLabelText('resolved'))
      fireEvent.change(screen.getByLabelText('Note (optional)'), {
        target: { value: 'duplicate' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Resolve selected' }))

      await waitFor(() =>
        expect(window.confirm).toHaveBeenCalledWith(
          'Resolve 2 selected quarantined event(s) as resolved?'
        )
      )
      await waitFor(() =>
        expect(mockBatchResolveFailedEvents).toHaveBeenCalledWith(
          { ids: [12, 13], resolution: 'resolved', note: 'duplicate' },
          expect.objectContaining({ address: 'GALICE' })
        )
      )
      expect(await screen.findByText(/Resolved 2 event\(s\)/)).toBeInTheDocument()
      expect(screen.getByLabelText('Select all')).not.toBeChecked()
    })

    it('does not submit when confirmation is declined', async () => {
      vi.mocked(window.confirm).mockReturnValue(false)
      mockGetFailedEvents.mockResolvedValue([event(12)])
      await openQuarantineTab()

      fireEvent.click(screen.getByLabelText('Select event 12'))
      fireEvent.click(screen.getByLabelText('ignored'))
      fireEvent.click(screen.getByRole('button', { name: 'Resolve selected' }))

      await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1))
      expect(mockBatchResolveFailedEvents).not.toHaveBeenCalled()
    })
  })
})
