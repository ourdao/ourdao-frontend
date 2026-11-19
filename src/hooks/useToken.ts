'use client'

import { useQuery } from '@tanstack/react-query'
import { daoRead, tokenRead } from '@/lib/dao-client'
import { isContractConfigured } from '@/lib/stellar'
import { useWallet } from '@/lib/wallet'
import { formatToken, parseToken } from '@/lib/utils'
import { queryKeys } from '@/lib/query-keys'

export interface TokenInfo {
  tokenId: string | null
  symbol: string
  decimals: number
  name: string
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

export function useToken(): TokenInfo {
  const { address } = useWallet()

  // 1. Read token contract address from DAO contract (immutable per deployment)
  const {
    data: tokenId,
    isLoading: isTokenIdLoading,
    isError: isTokenIdError,
    refetch: refetchTokenId,
  } = useQuery({
    queryKey: queryKeys.daoToken(),
    enabled: isContractConfigured(),
    queryFn: async () => {
      const id = await daoRead.getToken()
      return id || null
    },
    retry: 2,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  // 2. Read token metadata (symbol, decimals, name) from token contract (immutable)
  const {
    data: metadata,
    isLoading: isMetadataLoading,
    isError: isMetadataError,
    refetch: refetchMetadata,
  } = useQuery({
    queryKey: queryKeys.tokenMetadata(tokenId || ''),
    enabled: !!tokenId,
    queryFn: async () => {
      if (!tokenId) return null
      const [symbol, decimals, name] = await Promise.all([
        tokenRead.getSymbol(tokenId),
        tokenRead.getDecimals(tokenId),
        tokenRead.getName(tokenId),
      ])
      return {
        symbol: symbol || 'TOKEN',
        decimals: typeof decimals === 'number' ? decimals : 7,
        name: name || '',
      }
    },
    retry: 2,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  // 3. Read connected wallet's token balance (dynamic)
  const {
    data: balance,
    isLoading: isBalanceLoading,
    isError: isBalanceError,
    refetch: refetchBalance,
  } = useQuery({
    queryKey: address && tokenId ? queryKeys.tokenBalance(tokenId, address) : ['tokenBalance', null, null],
    enabled: !!tokenId && !!address,
    queryFn: async () => {
      if (!tokenId || !address) return BigInt(0)
      const bal = await tokenRead.getBalance(tokenId, address)
      return typeof bal === 'bigint' ? bal : BigInt(bal || 0)
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

  const symbol = metadata?.symbol || 'TOKEN'
  const decimals = metadata?.decimals ?? 7
  const userBalance = balance ?? BigInt(0)

  const refetch = () => {
    refetchTokenId()
    refetchMetadata()
    refetchBalance()
  }

  const format = (
    value: bigint | string,
    options?: { displayDecimals?: number; withSymbol?: boolean }
  ) => {
    const withSymbol = options?.withSymbol ?? true
    return formatToken(value, {
      decimals,
      displayDecimals: options?.displayDecimals,
      symbol: withSymbol ? symbol : undefined,
    })
  }

  const parse = (value: string) => {
    return parseToken(value, decimals)
  }

  const hasSufficientBalance = (amount: bigint | string) => {
    if (isTokenIdError || isMetadataError || isBalanceError) {
      return true
    }
    try {
      const needed = typeof amount === 'bigint' ? amount : parse(amount)
      return userBalance >= needed
    } catch {
      return false
    }
  }

  return {
    tokenId: tokenId || null,
    symbol,
    decimals,
    name: metadata?.name || '',
    balance: userBalance,
    isLoading: isTokenIdLoading || isMetadataLoading || isBalanceLoading,
    isError: isTokenIdError || isMetadataError || isBalanceError,
    format,
    parse,
    hasSufficientBalance,
    refetch,
  }
}
