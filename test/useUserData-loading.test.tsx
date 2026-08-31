import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUserData } from '@/hooks/useDAO'
import type { UserData } from '@/types/dao'

// #69: useUserData previously collapsed "membership not yet known" (query
// still in flight) and "confirmed not a member" into the same isMember:
// false — these tests assert isLoading actually distinguishes the two.

let resolveIsMember: (v: boolean) => void = () => {}

vi.mock('@/lib/wallet', () => ({
  useWallet: () => ({ address: 'GALICE', isConnected: true }),
}))

vi.mock('@/lib/stellar', () => ({
  isContractConfigured: () => true,
  CONTRACT_ID: 'CTEST',
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
}))

vi.mock('@/lib/dao-client', () => ({
  daoRead: {
    isMember: () =>
      new Promise<boolean>((resolve) => {
        resolveIsMember = resolve
      }),
    isAdmin: () => Promise.resolve(false),
    getMember: () => Promise.resolve(null),
    getPendingYield: () => Promise.resolve(0),
  },
  daoWrite: () => ({}),
}))

vi.mock('@/lib/backend', () => ({
  backend: {
    getLoans: () => Promise.resolve([]),
  },
}))

function Harness({ onRender }: { onRender: (data: UserData) => void }) {
  const data = useUserData()
  onRender(data)
  return null
}

function renderWithClient(onRender: (data: UserData) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Harness onRender={onRender} />
    </QueryClientProvider>
  )
}

describe('useUserData isLoading', () => {
  beforeEach(() => {
    resolveIsMember = () => {}
  })
  afterEach(() => vi.clearAllMocks())

  it('reports isLoading: true and isMember: false while the read is in flight — not yet a real "non-member" answer', async () => {
    let latest: UserData | undefined
    renderWithClient((d) => {
      latest = d
    })

    await waitFor(() => expect(latest?.isLoading).toBe(true))
    expect(latest?.isMember).toBe(false)
  })

  it('settles to isLoading: false once the read resolves, with isMember reflecting the real value', async () => {
    let latest: UserData | undefined
    renderWithClient((d) => {
      latest = d
    })

    await waitFor(() => expect(latest?.isLoading).toBe(true))
    resolveIsMember(true)

    await waitFor(() => expect(latest?.isLoading).toBe(false))
    expect(latest?.isMember).toBe(true)
  })
})
