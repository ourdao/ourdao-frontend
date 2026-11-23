// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const TEST_ADDRESS = 'GALICE1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF'

vi.mock('next/navigation', () => ({
  useParams: () => ({ address: TEST_ADDRESS }),
}))

vi.mock('@/hooks/useDAO', () => ({
  useMemberSummary: () => ({
    summary: {
      is_active: true,
      joined_at: 1_700_000_000,
      shares_bps: 2500,
      staked_amount: '1000000000',
      loans_count: 1,
      votes_count: 3,
    },
  }),
  useMemberActivity: () => ({
    activity: [],
    isLoading: false,
  }),
  eventLabel: (s: string) => s,
}))

describe('MemberProfilePage (#562)', () => {
  const originalPassphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE

  afterEach(() => {
    if (originalPassphrase === undefined) {
      delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE
    } else {
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = originalPassphrase
    }
    vi.resetModules()
  })

  it('links to testnet explorer when NEXT_PUBLIC_NETWORK_PASSPHRASE is Test SDF Network', async () => {
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'
    vi.resetModules()
    const { default: MemberProfilePage } = await import('@/app/(app)/members/[address]/page')

    render(<MemberProfilePage />)

    const link = screen.getByRole('link', { name: /view on explorer/i })
    expect(link.getAttribute('href')).toBe(
      `https://stellar.expert/explorer/testnet/account/${TEST_ADDRESS}`
    )
  }, 30_000)

  it('links to public explorer when NEXT_PUBLIC_NETWORK_PASSPHRASE is Public Global Stellar Network', async () => {
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015'
    vi.resetModules()
    const { default: MemberProfilePage } = await import('@/app/(app)/members/[address]/page')

    render(<MemberProfilePage />)

    const link = screen.getByRole('link', { name: /view on explorer/i })
    expect(link.getAttribute('href')).toBe(
      `https://stellar.expert/explorer/public/account/${TEST_ADDRESS}`
    )
  })
})
