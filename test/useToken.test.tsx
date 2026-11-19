// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToken } from '@/hooks/useToken'

const mockGetToken = vi.fn()
const mockGetSymbol = vi.fn()
const mockGetDecimals = vi.fn()
const mockGetName = vi.fn()
const mockGetBalance = vi.fn()

vi.mock('@/lib/stellar', async () => {
  const actual = await vi.importActual<typeof import('@/lib/stellar')>('@/lib/stellar')
  return { ...actual, isContractConfigured: () => true }
})

vi.mock('@/lib/wallet', () => ({
  useWallet: () => ({
    address: 'GALICE1234567890',
    isConnected: true,
  }),
}))

vi.mock('@/lib/dao-client', () => ({
  daoRead: {
    getToken: (...a: unknown[]) => mockGetToken(...a),
  },
  tokenRead: {
    getSymbol: (...a: unknown[]) => mockGetSymbol(...a),
    getDecimals: (...a: unknown[]) => mockGetDecimals(...a),
    getName: (...a: unknown[]) => mockGetName(...a),
    getBalance: (...a: unknown[]) => mockGetBalance(...a),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryDelay: 0,
      },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useToken (#558, #559, #560)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetToken.mockResolvedValue('CTOKEN123')
    mockGetSymbol.mockResolvedValue('USDC')
    mockGetDecimals.mockResolvedValue(6)
    mockGetName.mockResolvedValue('USD Coin')
    mockGetBalance.mockResolvedValue(BigInt(5_000_000))
  })

  it('#558: surfaces error when getToken rejects and recovers on refetch without reload', async () => {
    mockGetToken.mockRejectedValue(new Error('RPC down'))

    const { result } = renderHook(() => useToken(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.tokenId).toBeNull()

    mockGetToken.mockResolvedValue('CTOKEN123')
    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.tokenId).toBe('CTOKEN123')
    })
    expect(result.current.isError).toBe(false)
  }, 20_000)

  it('#558: returns null without error when contract genuinely returns no token', async () => {
    mockGetToken.mockResolvedValueOnce('')

    const { result } = renderHook(() => useToken(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.isError).toBe(false)
    expect(result.current.tokenId).toBeNull()
  })

  it('#559: does not cache fallback 7 decimals when getDecimals rejects, and formats correctly after refetch', async () => {
    mockGetDecimals.mockRejectedValue(new Error('RPC error'))

    const { result } = renderHook(() => useToken(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    mockGetDecimals.mockResolvedValue(6)
    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.decimals).toBe(6)
    })
    expect(result.current.isError).toBe(false)
    expect(result.current.format(BigInt(1_000_000), { withSymbol: false })).toBe('1')
  })

  it('#559: applies 7-decimal fallback only when contract returns missing decimals', async () => {
    mockGetDecimals.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useToken(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.isError).toBe(false)
    expect(result.current.decimals).toBe(7)
  })

  it('#560: surfaces error when getBalance rejects, keeps hasSufficientBalance permissive while errored, and recovers on refetch', async () => {
    mockGetBalance.mockRejectedValueOnce(new Error('Horizon 503')).mockResolvedValue(BigInt(2_000_000))

    const { result } = renderHook(() => useToken(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.hasSufficientBalance(BigInt(1_000_000))).toBe(true)

    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.balance).toBe(BigInt(2_000_000))
    })
    expect(result.current.isError).toBe(false)
    expect(result.current.hasSufficientBalance(BigInt(1_000_000))).toBe(true)
    expect(result.current.hasSufficientBalance(BigInt(5_000_000))).toBe(false)
  })
})
