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

vi.mock('@/hooks/useDAO', () => ({
  useDocumentHistory: () => ({
    history: mockHistory,
    isLoading: false,
    isError: false,
  }),
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
  })

  it('shows the CID without an "Open" link when no IPFS gateway is configured', async () => {
    delete process.env.NEXT_PUBLIC_IPFS_GATEWAY
    vi.resetModules()
    const { DocumentHistory } = await import('@/components/DocumentHistory')

    render(<DocumentHistory kind="loan" proposalId={1} />)

    expect(screen.getByText(mockHistory[0].cid)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /open/i })).toBeNull()
  }, 30_000)

  it('uses the first gateway from a comma-separated NEXT_PUBLIC_IPFS_GATEWAY list', async () => {
    process.env.NEXT_PUBLIC_IPFS_GATEWAY =
      'https://ipfs.example.org/ipfs/, https://backup.example.org/ipfs/'
    vi.resetModules()
    const { DocumentHistory } = await import('@/components/DocumentHistory')

    render(<DocumentHistory kind="loan" proposalId={1} />)

    const openLink = screen.getByRole('link', { name: /open/i })
    expect(openLink.getAttribute('href')).toBe(
      `https://ipfs.example.org/ipfs/${mockHistory[0].cid}`
    )
  })
})
