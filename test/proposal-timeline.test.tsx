// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const TX_HASH = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'

vi.mock('@/hooks/useDAO', () => ({
  useLoanTimeline: () => ({
    timeline: [
      {
        symbol: 'loan_created',
        ledger: 500,
        created_at: 1_700_000_000,
        tx_hash: TX_HASH,
      },
    ],
    isLoading: false,
  }),
  useTreasuryTimeline: () => ({ timeline: [], isLoading: false }),
  eventLabel: (s: string) => s,
  useVotingWeight: () => ({ votingWeight: 4, isLoading: false, isError: false, refetch: vi.fn() }),
}))

describe('ProposalTimeline (#561)', () => {
  const originalPassphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE

  afterEach(() => {
    if (originalPassphrase === undefined) {
      delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE
    } else {
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = originalPassphrase
    }
    vi.resetModules()
  })

  it('builds a testnet transaction URL when configured for testnet', async () => {
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'
    vi.resetModules()
    const { ProposalTimeline } = await import('@/components/ProposalTimeline')

    render(<ProposalTimeline kind="loan" id={1} />)

    const link = screen.getByRole('link', { name: /tx a1b2c3d4/i })
    expect(link.getAttribute('href')).toBe(`https://stellar.expert/explorer/testnet/tx/${TX_HASH}`)
  })

  it('builds a public transaction URL when configured for mainnet', async () => {
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015'
    vi.resetModules()
    const { ProposalTimeline } = await import('@/components/ProposalTimeline')

    render(<ProposalTimeline kind="loan" id={1} />)

    const link = screen.getByRole('link', { name: /tx a1b2c3d4/i })
    expect(link.getAttribute('href')).toBe(`https://stellar.expert/explorer/public/tx/${TX_HASH}`)
  })
})
