'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useWallet } from '@/lib/wallet'
import {
  backend,
  MAX_FAILED_EVENTS_PER_BATCH,
  type BatchResolveFailedEventsInput,
  type FailedEventBatchResolveResult,
  type FailedEventReEvaluationResult,
} from '@/lib/backend'
import { queryKeys } from '@/lib/query-keys'
import { announce } from '@/lib/announce'

const FAILED_EVENT_QUERY_KEYS = [
  queryKeys.failedEvents(),
  queryKeys.daoStatsBackend(),
  queryKeys.backendStats(),
]

function failureMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message) return cause.message
  return 'The quarantined event could not be updated.'
}

/**
 * Signed admin actions share the wallet's message signer. The backend issues a
 * single-use nonce per request, so the client serializes calls per address and
 * fetches a fresh challenge each time.
 */
function useFailedEventSigner() {
  const { address, isConnected, signMessage } = useWallet()
  return { address: address ?? '', signMessage, isConnected: isConnected && !!address }
}

export function useReEvaluateFailedEvent() {
  const queryClient = useQueryClient()
  const { address, signMessage, isConnected } = useFailedEventSigner()
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<FailedEventReEvaluationResult | null>(null)

  const reEvaluate = useCallback(
    async (id: number | string): Promise<FailedEventReEvaluationResult | null> => {
      if (!isConnected || !address) {
        const message = 'Connect your wallet to re-evaluate quarantined events.'
        setError(message)
        announce(message, 'assertive')
        return null
      }
      setPending(true)
      setError(null)
      setResult(null)
      try {
        const outcome = await backend.reEvaluateFailedEvent(id, { address, signMessage })
        setResult(outcome)
        await Promise.all(
          FAILED_EVENT_QUERY_KEYS.map((queryKey) =>
            queryClient.invalidateQueries({ queryKey })
          )
        )
        return outcome
      } catch (cause) {
        const message = failureMessage(cause)
        setError(message)
        announce(message, 'assertive')
        return null
      } finally {
        setPending(false)
      }
    },
    [address, isConnected, queryClient, signMessage]
  )

  return { reEvaluate, isPending, error, result }
}

/**
 * Resolves a selection in chunks of at most 500 ids (the backend limit). Each
 * chunk gets its own signed challenge; the UI reports the sum of the returned
 * counts because the backend skips already-resolved ids.
 */
export function useBatchResolveFailedEvents() {
  const queryClient = useQueryClient()
  const { address, signMessage, isConnected } = useFailedEventSigner()
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<FailedEventBatchResolveResult | null>(null)

  const batchResolve = useCallback(
    async (input: BatchResolveFailedEventsInput): Promise<FailedEventBatchResolveResult | null> => {
      if (!isConnected || !address) {
        const message = 'Connect your wallet to resolve quarantined events.'
        setError(message)
        announce(message, 'assertive')
        return null
      }
      setPending(true)
      setError(null)
      setResult(null)
      try {
        let resolved = 0
        for (let offset = 0; offset < input.ids.length; offset += MAX_FAILED_EVENTS_PER_BATCH) {
          const chunk = await backend.batchResolveFailedEvents(
            { ...input, ids: input.ids.slice(offset, offset + MAX_FAILED_EVENTS_PER_BATCH) },
            { address, signMessage }
          )
          resolved += chunk.resolved
        }
        const outcome = { resolved }
        setResult(outcome)
        await Promise.all(
          FAILED_EVENT_QUERY_KEYS.map((queryKey) =>
            queryClient.invalidateQueries({ queryKey })
          )
        )
        return outcome
      } catch (cause) {
        const message = failureMessage(cause)
        setError(message)
        announce(message, 'assertive')
        return null
      } finally {
        setPending(false)
      }
    },
    [address, isConnected, queryClient, signMessage]
  )

  return { batchResolve, isPending, error, result }
}
