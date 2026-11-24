'use client'

import { useWhitelistedTokens } from '@/hooks/useWhitelistedTokens'
import { useAssetBalance } from '@/hooks/useAssetBalance'

export interface TreasuryBalance {
  tokenId: string
  symbol: string
  balance: string
  decimals: number
}

export function TreasuryBalances() {
  const { tokens, isLoading: tokensLoading, isError: tokensError } =
    useWhitelistedTokens()

  if (tokensError) {
    return <div className="text-red-500">Failed to load treasury balances</div>
  }

  if (tokensLoading) {
    return <div className="text-gray-500">Loading treasury balances...</div>
  }

  if (tokens.length === 0) {
    return <div className="text-gray-500">No assets in treasury</div>
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Treasury Balances</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tokens.map((token) => (
          <TreasuryBalanceCard key={token.tokenId} tokenId={token.tokenId} />
        ))}
      </div>
    </div>
  )
}

function TreasuryBalanceCard({ tokenId }: { tokenId: string }) {
  const { symbol, balance, format, isLoading, isError } =
    useAssetBalance(tokenId)

  if (isError) {
    return (
      <div className="border rounded-lg p-4 bg-red-50">
        <div className="text-sm text-red-600">Failed to load balance</div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-sm text-gray-600">Asset</div>
          <div className="text-lg font-semibold">{symbol || 'Loading...'}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600">Balance</div>
          <div className="text-lg font-semibold">
            {isLoading ? (
              <span className="text-gray-500">Loading...</span>
            ) : (
              format(balance, { withSymbol: true })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
