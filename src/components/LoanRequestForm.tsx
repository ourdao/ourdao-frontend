'use client'

import { useState } from 'react'
import { AssetSelector } from './AssetSelector'
import { useAssetBalance } from '@/hooks/useAssetBalance'

export interface LoanRequestFormData {
  assetId: string
  amount: string
  duration: number
  interestRate: number
}

interface LoanRequestFormProps {
  onSubmit: (data: LoanRequestFormData) => Promise<void>
  isSubmitting?: boolean
  error?: string
}

export function LoanRequestForm({
  onSubmit,
  isSubmitting = false,
  error,
}: LoanRequestFormProps) {
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [duration, setDuration] = useState(30)
  const [interestRate, setInterestRate] = useState(5)
  const [formError, setFormError] = useState<string | null>(null)

  const { hasSufficientBalance, format } = useAssetBalance(selectedAsset)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)

    if (!selectedAsset) {
      setFormError('Please select an asset')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      setFormError('Please enter a valid amount')
      return
    }

    if (!hasSufficientBalance(amount)) {
      setFormError('Insufficient balance for this amount')
      return
    }

    try {
      await onSubmit({
        assetId: selectedAsset,
        amount,
        duration,
        interestRate,
      })
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to create loan request'
      )
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
      <h2 className="text-xl font-semibold">Request Loan</h2>

      {(formError || error) && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {formError || error}
        </div>
      )}

      <div>
        <AssetSelector
          value={selectedAsset}
          onChange={setSelectedAsset}
          label="Loan Asset"
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Amount</label>
        <input
          type="number"
          step="0.000001"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isSubmitting || !selectedAsset}
          placeholder="Enter amount"
          className="w-full px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Duration (days)</label>
        <input
          type="number"
          min="1"
          max="365"
          value={duration}
          onChange={(e) => setDuration(parseInt(e.target.value, 10))}
          disabled={isSubmitting}
          className="w-full px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Interest Rate (%)
        </label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={interestRate}
          onChange={(e) => setInterestRate(parseFloat(e.target.value))}
          disabled={isSubmitting}
          className="w-full px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !selectedAsset}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
      >
        {isSubmitting ? 'Creating Loan Request...' : 'Create Loan Request'}
      </button>
    </form>
  )
}
