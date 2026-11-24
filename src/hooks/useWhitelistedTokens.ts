'use client'

import { useQuery } from '@tanstack/react-query'
import { daoRead } from '@/lib/dao-client'
import { isContractConfigured } from '@/lib/stellar'
import { queryKeys } from '@/lib/query-keys'

export interface WhitelistedToken {
  tokenId: string
  symbol: string
  decimals: number
  name: string
}

export interface UseWhitelistedTokensResult {
  tokens: WhitelistedToken[]
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

export function useWhitelistedTokens(): UseWhitelistedTokensResult {
  const {
    data: tokens = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.whitelistedTokens(),
    enabled: isContractConfigured(),
    queryFn: async () => {
      const whitelistedTokens = await daoRead.getWhitelistedTokens()
      return whitelistedTokens || []
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })

  return {
    tokens,
    isLoading,
    isError,
    refetch,
  }
}
