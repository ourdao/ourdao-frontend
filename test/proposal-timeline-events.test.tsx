// @vitest-environment jsdom
// Covers src/components/ProposalTimeline.tsx event rendering (issue #597).
//
// Mocking boundary (docs/decisions/ADR-005-mocking-boundary.md): only the API
// client `backend` in src/lib/backend.ts is replaced. useLoanTimeline,
// useTreasuryTimeline and eventLabel run for real, so the query wiring and the
// symbol-to-label mapping are exercised. No hook is mocked.
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { Networks } from '@stellar/stellar-sdk'
import { renderWithProviders } from './test-utils'
import { ProposalTimeline } from '@/components/ProposalTimeline'
import { formatDate } from '@/lib/utils'

const { mockGetLoanTimeline, mockGetTreasuryTimeline } = vi.hoisted(() => ({
  mockGetLoanTimeline: vi.fn(),
  mockGetTreasuryTimeline: vi.fn(),
}))

vi.mock('@/lib/backend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backend')>()
  return {
    ...actual,
    backend: {
      ...actual.backend,
      getLoanTimeline: (...args: unknown[]) => mockGetLoanTimeline(...args),
      getTreasuryTimeline: (...args: unknown[]) => mockGetTreasuryTimeline(...args),
    },
  }
})

type Props = ComponentProps<typeof ProposalTimeline>
type Row = {
  symbol: string
  ledger: number
  tx_hash: string | null
  created_at: string
}

const TX_HASH = 'abcdef12' + '0'.repeat(56)

// Ledger-ordered fixture: the component renders rows in array order.
const LEDGER_ORDERED_ROWS: Row[] = [
  { symbol: 'loan_req', ledger: 100, tx_hash: null, created_at: '2026-01-01T00:00:00Z' },
  { symbol: 'loan_vote', ledger: 105, tx_hash: null, created_at: '2026-01-02T00:00:00Z' },
  { symbol: 'loan_appr', ledger: 110, tx_hash: null, created_at: '2026-01-03T00:00:00Z' },
]

// The backend row cap is not exposed to the client (BackendTimelineEvent[] has
// no truncation flag). 200 is a placeholder; confirm the real cap in the backend
// and update this constant.
const ASSUMED_ROW_CAP = 200

const cleanups: Array<() => void> = []

/**
 * Renders the component against a freshly evaluated `@/lib/stellar`, so the
 * NETWORK_PASSPHRASE read at module load picks up the stubbed env value.
 */
async function renderOnNetwork(passphrase: string, props: Props) {
  vi.stubEnv('NEXT_PUBLIC_NETWORK_PASSPHRASE', passphrase)
  vi.resetModules()
  const { ProposalTimeline: FreshTimeline } = await import('@/components/ProposalTimeline')
  const result = renderWithProviders(<FreshTimeline {...props} />)
  cleanups.push(result.unmount)
  return result
}

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.()
  vi.unstubAllEnvs()
  mockGetLoanTimeline.mockReset()
  mockGetTreasuryTimeline.mockReset()
})

describe('ProposalTimeline event rendering (#597)', () => {
  it('renders events in ledger order with a label per known event symbol', async () => {
    mockGetLoanTimeline.mockResolvedValue(LEDGER_ORDERED_ROWS)
    renderWithProviders(<ProposalTimeline kind="loan" id={7} />)

    await screen.findByText('Loan requested')

    // Labels come from EVENT_CATALOG via eventLabel (real code).
    expect(screen.getByText('Loan requested')).toBeInTheDocument()
    expect(screen.getByText('Loan vote cast')).toBeInTheDocument()
    expect(screen.getByText('Loan approved')).toBeInTheDocument()

    // DOM order follows the input (ledger) order.
    const labels = screen
      .getAllByText(/^(Loan requested|Loan vote cast|Loan approved)$/)
      .map((el) => el.textContent)
    expect(labels).toEqual(['Loan requested', 'Loan vote cast', 'Loan approved'])

    const ledgers = screen.getAllByText(/^Ledger \d+$/).map((el) => el.textContent)
    expect(ledgers).toEqual(['Ledger 100', 'Ledger 105', 'Ledger 110'])
  })

  it('falls back to the raw symbol for an unknown event symbol', async () => {
    mockGetLoanTimeline.mockResolvedValue([
      { symbol: 'mystery_evt', ledger: 42, tx_hash: null, created_at: '2026-01-01T00:00:00Z' },
    ])
    renderWithProviders(<ProposalTimeline kind="loan" id={7} />)

    expect(await screen.findByText('mystery_evt')).toBeInTheDocument()
  })

  it('renders the treasury timeline through the treasury query', async () => {
    mockGetTreasuryTimeline.mockResolvedValue([
      { symbol: 'tre_vote', ledger: 9, tx_hash: null, created_at: '2026-01-01T00:00:00Z' },
    ])
    renderWithProviders(<ProposalTimeline kind="treasury" id={3} />)

    expect(await screen.findByText('Treasury vote cast')).toBeInTheDocument()
    expect(mockGetTreasuryTimeline).toHaveBeenCalledWith(3, expect.anything())
    expect(mockGetLoanTimeline).not.toHaveBeenCalled()
  })

  it('shows the fallback dates when the timeline is empty', async () => {
    mockGetLoanTimeline.mockResolvedValue([])
    const created = 1_700_000_000
    const votingStart = 1_700_003_600
    const votingEnd = 1_700_090_000
    const disbursed = 1_700_180_000

    renderWithProviders(
      <ProposalTimeline
        kind="loan"
        id={7}
        fallbackDates={{ created, votingStart, votingEnd, disbursed }}
      />
    )

    expect(await screen.findByText('Created')).toBeInTheDocument()
    expect(screen.getByText('Voting Started')).toBeInTheDocument()
    expect(screen.getByText('Voting Ends')).toBeInTheDocument()
    expect(screen.getByText('Disbursed')).toBeInTheDocument()
    expect(screen.getByText(formatDate(created))).toBeInTheDocument()
    expect(screen.getByText(formatDate(votingStart))).toBeInTheDocument()
    expect(screen.getByText(formatDate(votingEnd))).toBeInTheDocument()
    expect(screen.getByText(formatDate(disbursed))).toBeInTheDocument()
  })

  it('hides the fallback dates once the timeline has events', async () => {
    mockGetLoanTimeline.mockResolvedValue(LEDGER_ORDERED_ROWS)
    renderWithProviders(
      <ProposalTimeline kind="loan" id={7} fallbackDates={{ created: 1_700_000_000 }} />
    )

    await screen.findByText('Loan requested')
    expect(screen.queryByText('Created')).not.toBeInTheDocument()
  })

  it('shows the empty message when the timeline is empty and no fallback is given', async () => {
    mockGetLoanTimeline.mockResolvedValue([])
    renderWithProviders(<ProposalTimeline kind="loan" id={7} />)

    expect(await screen.findByText('No timeline events recorded yet.')).toBeInTheDocument()
  })

  it('shows the loading state while the timeline request is pending', () => {
    mockGetLoanTimeline.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<ProposalTimeline kind="loan" id={7} />)

    expect(screen.getByText('Loading timeline events...')).toBeInTheDocument()
  })

  it('links a tx_hash to the testnet explorer when configured for testnet', async () => {
    mockGetLoanTimeline.mockResolvedValue([
      { symbol: 'loan_appr', ledger: 110, tx_hash: TX_HASH, created_at: '2026-01-03T00:00:00Z' },
    ])
    await renderOnNetwork(Networks.TESTNET, { kind: 'loan', id: 7 })

    const link = await screen.findByRole('link', { name: /Tx abcdef12/ })
    expect(link.getAttribute('href')).toBe(`https://stellar.expert/explorer/testnet/tx/${TX_HASH}`)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('links a tx_hash to the public explorer when configured for mainnet', async () => {
    mockGetLoanTimeline.mockResolvedValue([
      { symbol: 'loan_appr', ledger: 110, tx_hash: TX_HASH, created_at: '2026-01-03T00:00:00Z' },
    ])
    await renderOnNetwork(Networks.PUBLIC, { kind: 'loan', id: 7 })

    const link = await screen.findByRole('link', { name: /Tx abcdef12/ })
    expect(link.getAttribute('href')).toBe(`https://stellar.expert/explorer/public/tx/${TX_HASH}`)
    expect(screen.queryByText(/explorer\/testnet/)).not.toBeInTheDocument()
  })

  it('renders no transaction link when the network has no explorer', async () => {
    mockGetLoanTimeline.mockResolvedValue([
      { symbol: 'loan_appr', ledger: 110, tx_hash: TX_HASH, created_at: '2026-01-03T00:00:00Z' },
    ])
    await renderOnNetwork(Networks.FUTURENET, { kind: 'loan', id: 7 })

    await screen.findByText('Loan approved')
    expect(screen.queryByRole('link', { name: /^Tx / })).not.toBeInTheDocument()
  })

  it('renders no transaction link for an event without a tx_hash', async () => {
    mockGetLoanTimeline.mockResolvedValue(LEDGER_ORDERED_ROWS)
    renderWithProviders(<ProposalTimeline kind="loan" id={7} />)

    await screen.findByText('Loan requested')
    expect(screen.queryByRole('link', { name: /^Tx / })).not.toBeInTheDocument()
  })

  it('does not present a timeline that hit the backend row cap as complete', async () => {
    const capped: Row[] = Array.from({ length: ASSUMED_ROW_CAP }, (_, i) => ({
      symbol: 'loan_rpy',
      ledger: 1000 + i,
      tx_hash: null,
      created_at: '2026-01-01T00:00:00Z',
    }))
    mockGetLoanTimeline.mockResolvedValue(capped)
    const { container } = renderWithProviders(<ProposalTimeline kind="loan" id={7} />)

    await waitFor(() => {
      expect(within(container).getAllByText('Loan repayment')).toHaveLength(ASSUMED_ROW_CAP)
    })
    expect(screen.queryByText(/complete|full history|all events|showing all/i)).not.toBeInTheDocument()
  })
})
