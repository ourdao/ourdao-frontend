// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDelegate, useDelegateVote } from '@/hooks/useDAO'

const mockGetDelegate = vi.fn()
const mockDelegateVote = vi.fn()

vi.mock('@/lib/wallet', () => ({
  useWallet: () => ({
    address: 'GALICE',
    isConnected: true,
    signXDR: vi.fn(),
  }),
}))

vi.mock('@/lib/stellar', async () => {
  const actual = await vi.importActual<typeof import('@/lib/stellar')>('@/lib/stellar')
  return { ...actual, isContractConfigured: () => true }
})

vi.mock('@/lib/dao-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/dao-client')>()
  return {
    ...actual,
    daoRead: {
      ...actual.daoRead,
      getDelegate: (...args: unknown[]) => mockGetDelegate(...args),
    },
    daoWrite: () => ({
      delegateVote: (...args: unknown[]) => mockDelegateVote(...args),
    }),
  }
})

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'id') },
}))

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function Harness<T>({ useHook, onRender }: { useHook: () => T; onRender: (h: T) => void }) {
  const hook = useHook()
  onRender(hook)
  return null
}

function renderWithClient<T>(client: QueryClient, useHook: () => T, onRender: (h: T) => void) {
  render(
    <QueryClientProvider client={client}>
      <Harness useHook={useHook} onRender={onRender} />
    </QueryClientProvider>
  )
}

describe('useDelegate', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('returns the address the member delegated to', async () => {
    mockGetDelegate.mockResolvedValue('GBOB')
    let latest: ReturnType<typeof useDelegate> | undefined
    renderWithClient(makeClient(), () => useDelegate('GALICE'), (h) => { latest = h })

    await waitFor(() => expect(latest?.isLoading).toBe(false))
    expect(latest?.delegate).toBe('GBOB')
    expect(mockGetDelegate).toHaveBeenCalledWith('GALICE')
  })

  it('returns null when the member has not delegated', async () => {
    mockGetDelegate.mockResolvedValue(null)
    let latest: ReturnType<typeof useDelegate> | undefined
    renderWithClient(makeClient(), () => useDelegate('GALICE'), (h) => { latest = h })

    await waitFor(() => expect(latest?.isLoading).toBe(false))
    expect(latest?.delegate).toBeNull()
  })

  it('reports an error and does not fake a delegate when the read fails', async () => {
    mockGetDelegate.mockRejectedValue(new Error('rpc unavailable'))
    let latest: ReturnType<typeof useDelegate> | undefined
    renderWithClient(makeClient(), () => useDelegate('GALICE'), (h) => { latest = h })

    await waitFor(() => expect(latest?.isError).toBe(true))
    expect(latest?.delegate).toBeNull()
  })
})

describe('useDelegateVote', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('submits the delegation and invalidates the delegate and user-data queries', async () => {
    mockDelegateVote.mockResolvedValue({ hash: 'tx1', returnValue: null })
    const client = makeClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    let latest: ReturnType<typeof useDelegateVote> | undefined
    renderWithClient(client, useDelegateVote, (h) => { latest = h })

    await act(async () => {
      await latest!.delegate('GBOB')
    })

    expect(mockDelegateVote).toHaveBeenCalledWith('GBOB')
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['delegate', 'GALICE'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['userData', 'GALICE'] })
    })
  })

  it('surfaces a rejected delegation and leaves the cached delegate untouched', async () => {
    mockDelegateVote.mockRejectedValue(new Error('User declined'))
    const client = makeClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    let latest: ReturnType<typeof useDelegateVote> | undefined
    renderWithClient(client, useDelegateVote, (h) => { latest = h })

    await act(async () => {
      await latest!.delegate('GBOB').catch(() => undefined)
    })

    await waitFor(() => expect(latest?.error).toBeTruthy())
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['delegate', 'GALICE'] })
  })
})
