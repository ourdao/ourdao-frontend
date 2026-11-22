// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useStake } from '@/hooks/dao/proposal-reads'
import { useUserData } from '@/hooks/dao/reads'
import { daoRead } from '@/lib/dao-client'

// #486: a stake read that is in flight or fails must never be reported as a
// zero stake / base voting weight. These tests pin that down for both reads.

vi.mock('@/lib/wallet', () => ({
  useWallet: () => ({ address: 'GSTAKE', isConnected: true }),
}))

vi.mock('@/lib/stellar', () => ({
  CONTRACT_ID: 'CCONTRACT',
  isContractConfigured: () => true,
}))

vi.mock('@/lib/backend', () => ({
  backend: { getLoans: () => Promise.resolve([]) },
  isBackendConfigured: () => false,
}))

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  }
}

describe('useStake', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns stake: null while the read is in flight, not 0', async () => {
    vi.spyOn(daoRead, 'getStake').mockReturnValue(new Promise(() => {}))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useStake(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(true))
    expect(result.current.stake).toBeNull()
    expect(result.current.isError).toBe(false)
  })

  it('returns stake: null and isError: true when the read fails', async () => {
    vi.spyOn(daoRead, 'getStake').mockRejectedValue(new Error('rpc down'))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useStake(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.stake).toBeNull()
  })

  it('returns the real stake once the read succeeds', async () => {
    vi.spyOn(daoRead, 'getStake').mockResolvedValue(BigInt(250000000))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useStake(), { wrapper })

    await waitFor(() => expect(result.current.stake).toBe(BigInt(250000000)))
    expect(result.current.isError).toBe(false)
  })
})

describe('useUserData voting weight when the stake read fails', () => {
  beforeEach(() => {
    vi.spyOn(daoRead, 'isMember').mockResolvedValue(true)
    vi.spyOn(daoRead, 'isAdmin').mockResolvedValue(false)
    vi.spyOn(daoRead, 'getMember').mockResolvedValue(null)
    vi.spyOn(daoRead, 'getPendingYield').mockResolvedValue(BigInt(0))
    vi.spyOn(daoRead, 'calculateExitShare').mockResolvedValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports votingWeight: null (unknown), not the base weight, when get_stake rejects', async () => {
    vi.spyOn(daoRead, 'getStake').mockRejectedValue(new Error('transient RPC error'))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUserData(), { wrapper })

    await waitFor(() => expect(result.current.isMember).toBe(true))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.votingWeight).toBeNull()
  })

  it('computes a real voting weight when get_stake succeeds', async () => {
    vi.spyOn(daoRead, 'getStake').mockResolvedValue(BigInt(0))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUserData(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isMember).toBe(true)
    expect(typeof result.current.votingWeight).toBe('number')
  })
})
