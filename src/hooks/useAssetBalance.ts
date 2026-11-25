'use client'

import { useQuery } from '@tanstack/react-query'
import { tokenRead } from '@/lib/dao-client'
import { isContractConfigured } from '@/lib/stellar'
import { useWallet } from '@/lib/wallet'
import { formatToken, parseToken } from '@/lib/utils'
import { queryKeys } from '@/lib/query-keys'

export interface AssetBalance {
  tokenId: string
  symbol: string
  decimals: number
  balance: bigint
  isLoading: boolean
  isError: boolean
  format: (
    value: bigint | string,
    options?: { displayDecimals?: number; withSymbol?: boolean }
  ) => string
  parse: (value: string) => bigint
  hasSufficientBalance: (amount: bigint | string) => boolean
  refetch: () => void
}

export function useAssetBalance(tokenId: string | null | undefined): AssetBalance {
  const { address } = useWallet()

  const {
    data: balanceData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.assetBalance(tokenId, address),
    enabled: !!(tokenId && isContractConfigured() && address),
    queryFn: async () => {
      if (!tokenId || !address) return null

      const balance = await tokenRead.getBalance(tokenId, address)
      return balance || 0n
    },
    retry: 2,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })

  const balance = balanceData || 0n
  const decimals = 6 // Default decimals, should be fetched from token metadata

  return {
    tokenId: tokenId || '',
    symbol: '', // Should be fetched from token metadata
    decimals,
    balance,
    isLoading,
    isError,
    format: (value: bigint | string, options) =>
      formatToken(value, decimals, options),
    parse: (value: string) => parseToken(value, decimals),
    hasSufficientBalance: (amount: bigint | string) => {
      const amountBigInt =
        typeof amount === 'string' ? parseToken(amount, decimals) : amount
      return balance >= amountBigInt
    },
    refetch,
  }
}
