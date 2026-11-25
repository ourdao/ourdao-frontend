'use client'

import { useState } from 'react'
import { useWhitelistedTokens } from '@/hooks/useWhitelistedTokens'

interface AssetSelectorProps {
  value: string | null
  onChange: (tokenId: string) => void
  disabled?: boolean
  label?: string
}

export function AssetSelector({
  value,
  onChange,
  disabled = false,
  label = 'Select Asset',
}: AssetSelectorProps) {
  const { tokens, isLoading, isError } = useWhitelistedTokens()
  const [isOpen, setIsOpen] = useState(false)

  const selectedToken = tokens.find((t) => t.tokenId === value)

  if (isError) {
    return <div className="text-red-500">Failed to load assets</div>
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-2">{label}</label>

      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isLoading}
        className="w-full px-4 py-2 border rounded-lg bg-white text-left disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="text-gray-500">Loading assets...</span>
        ) : selectedToken ? (
          <span>
            {selectedToken.symbol} - {selectedToken.name}
          </span>
        ) : (
          <span className="text-gray-500">Choose an asset...</span>
        )}
      </button>

      {isOpen && !isLoading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10">
          {tokens.length === 0 ? (
            <div className="p-4 text-gray-500">No assets available</div>
          ) : (
            tokens.map((token) => (
              <button
                key={token.tokenId}
                onClick={() => {
                  onChange(token.tokenId)
                  setIsOpen(false)
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b last:border-b-0"
              >
                <div className="font-medium">{token.symbol}</div>
                <div className="text-sm text-gray-600">{token.name}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
