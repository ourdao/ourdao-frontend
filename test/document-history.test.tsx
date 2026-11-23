// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockHistory = [
  {
    cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    attached_by: 'GALICE1234567890',
    ledger: 12345,
    created_at: 1_700_000_000,
  },
]

const mockUseDocumentHistory = vi.fn()

vi.mock('@/hooks/useDAO', () => ({
  useDocumentHistory: (...args: unknown[]) => mockUseDocumentHistory(...args),
}))

describe('DocumentHistory (#564)', () => {
  const originalGateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY

  afterEach(() => {
    if (originalGateway === undefined) {
      delete process.env.NEXT_PUBLIC_IPFS_GATEWAY
    } else {
      process.env.NEXT_PUBLIC_IPFS_GATEWAY = originalGateway
    }
    vi.resetModules()
    mockUseDocumentHistory.mockReset()
  })

  it('shows the CID without an "Open" link when no IPFS gateway is configured', async () => {
    delete process.env.NEXT_PUBLIC_IPFS_GATEWAY
    vi.resetModules()
    mockUseDocumentHistory.mockReturnValue({ history: mockHistory, isLoading: false, isError: false })
    const { DocumentHistory } = await import('@/components/DocumentHistory')

    render(<DocumentHistory kind="loan" proposalId={1} />)

    expect(screen.getByText(mockHistory[0].cid)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /open/i })).toBeNull()
  }, 30_000)

  it('uses the first gateway from a comma-separated NEXT_PUBLIC_IPFS_GATEWAY list', async () => {
    process.env.NEXT_PUBLIC_IPFS_GATEWAY =
      'https://ipfs.example.org/ipfs/, https://backup.example.org/ipfs/'
    vi.resetModules()
    mockUseDocumentHistory.mockReturnValue({ history: mockHistory, isLoading: false, isError: false })
    const { DocumentHistory } = await import('@/components/DocumentHistory')

    render(<DocumentHistory kind="loan" proposalId={1} />)

    const openLink = screen.getByRole('link', { name: /open/i })
    expect(openLink.getAttribute('href')).toBe(
      `https://ipfs.example.org/ipfs/${mockHistory[0].cid}`,
    )
  })
})

describe('DocumentHistory table states (#598)', () => {
  afterEach(() => {
    vi.resetModules()
    mockUseDocumentHistory.mockReset()
  })

  it('shows a loading message while the history is loading', async () => {
    mockUseDocumentHistory.mockReturnValue({ history: [], isLoading: true, isError: false })
    const { DocumentHistory } = await import('@/components/DocumentHistory')

    render(<DocumentHistory kind="loan" proposalId={1} />)

    expect(screen.getByText('Loading document history...')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  // The component currently renders nothing (returns null) for both an error
  // and an empty result — it does not distinguish them with separate messages.
  // This asserts the actual current behaviour; giving each its own message is
  // a separate change (see the issue's "Out of scope" note).
  it('renders nothing, not a table, when the history fetch errors', async () => {
    mockUseDocumentHistory.mockReturnValue({ history: [], isLoading: false, isError: true })
    const { DocumentHistory } = await import('@/components/DocumentHistory')

    const { container } = render(<DocumentHistory kind="loan" proposalId={1} />)

    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('renders nothing, not a table, when there is no history', async () => {
    mockUseDocumentHistory.mockReturnValue({ history: [], isLoading: false, isError: false })
    const { DocumentHistory } = await import('@/components/DocumentHistory')

    const { container } = render(<DocumentHistory kind="loan" proposalId={1} />)

    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('renders the attached-by address, CID, ledger and a formatted date for each row', async () => {
    mockUseDocumentHistory.mockReturnValue({ history: mockHistory, isLoading: false, isError: false })
    const { DocumentHistory } = await import('@/components/DocumentHistory')

    render(<DocumentHistory kind="loan" proposalId={1} />)

    const row = screen.getByRole('table')
    // AddressLink truncates the address to e.g. GALI…7890; the full value is
    // only exposed via `title`, so assert on that rather than the display text.
    expect(row.querySelector(`[title="${mockHistory[0].attached_by}"]`)).toBeTruthy()
    expect(screen.getByText(mockHistory[0].cid)).toBeTruthy()
    expect(screen.getByText(`#${mockHistory[0].ledger}`)).toBeTruthy()
    // formatDate's exact output depends on the runner's locale/timezone; just
    // assert it is not the raw unix timestamp or empty.
    const dateCell = row.querySelectorAll('td')[3]
    expect(dateCell?.textContent).toBeTruthy()
    expect(dateCell?.textContent).not.toBe(String(mockHistory[0].created_at))
  })

  it('renders one row per history item', async () => {
    const two = [
      mockHistory[0],
      { ...mockHistory[0], cid: 'bafybeicid2', ledger: 12346 },
    ]
    mockUseDocumentHistory.mockReturnValue({ history: two, isLoading: false, isError: false })
    const { DocumentHistory } = await import('@/components/DocumentHistory')

    render(<DocumentHistory kind="loan" proposalId={1} />)

    expect(screen.getAllByRole('row')).toHaveLength(two.length + 1) // + header row
  })
})
