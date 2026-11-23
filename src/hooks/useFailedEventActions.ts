'use client'

/**
 * Signed admin actions for quarantined indexer events (#637–#639).
 *
 * Both mutations go through the backend's challenge/response handshake, whose
 * nonce is single-use. Calls for the connected address are therefore chained
 * with `serializePerAddress`, including each chunk of a batched resolution.
 * The 422 `still_failing` outcome of a re-evaluation is a *result*, not an
 * error: the hook returns it so the row can show it inline instead of raising
 * a toast that implies the request failed.
 */
import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useWallet } from '@/lib/wallet'
import { serializePerAddress } from '@/lib/backend-auth'
import {
  backend,
  MAX_BATCH_RESOLVE_IDS,
  type BatchResolveFailedEventsInput,
  type ReEvaluateFailedEventResult,
} from '@/lib/backend'
import { queryKeys } from '@/lib/query-keys'
import { announce } from '@/lib/announce'

/** Refresh the quarantine list and every aggregate that counts quarantined events. */
function useInvalidateQuarantine() {
  const queryClient = useQueryClient()
  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.failedEvents() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.backendStats() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.daoStatsBackend() }),
    ])
  }, [queryClient])
}

function reportFailure(cause: unknown): void {
  const message = cause instanceof Error ? cause.message : 'The change could not be saved.'
  toast.error(message)
  announce(message, 'assertive')
}

export function useReEvaluateFailedEvent() {
  const { address, signMessage } = useWallet()
  const invalidate = useInvalidateQuarantine()
  const [isPending, setPending] = useState(false)

  const reEvaluateFailedEvent = useCallback(
    async (id: number | string): Promise<ReEvaluateFailedEventResult> => {
      if (!address) throw new Error('Connect your wallet first.')
      setPending(true)
      try {
        const result = await serializePerAddress(address, () =>
          backend.reEvaluateFailedEvent(id, { address, signMessage })
        )
        await invalidate()
        return result
      } catch (cause) {
        reportFailure(cause)
        throw cause
      } finally {
        setPending(false)
      }
    },
    [address, signMessage, invalidate]
  )

  return { reEvaluateFailedEvent, isPending }
}

export function useBatchResolveFailedEvents() {
  const { address, signMessage } = useWallet()
  const invalidate = useInvalidateQuarantine()
  const [isPending, setPending] = useState(false)

  const batchResolveFailedEvents = useCallback(
    async (input: BatchResolveFailedEventsInput) => {
      if (!address) throw new Error('Connect your wallet first.')
      setPending(true)
      try {
        // The backend caps a request at 500 ids. Larger selections are split,
        // each chunk getting its own signed request (and therefore its own
        // nonce); the total returned is the sum of what the backend changed.
        let resolved = 0
        for (let i = 0; i < input.ids.length; i += MAX_BATCH_RESOLVE_IDS) {
          const chunk = input.ids.slice(i, i + MAX_BATCH_RESOLVE_IDS)
          const result = await serializePerAddress(address, () =>
            backend.batchResolveFailedEvents(
              { ...input, ids: chunk },
              { address, signMessage }
            )
          )
          resolved += result.resolved
        }
        await invalidate()
        return { resolved }
      } catch (cause) {
        reportFailure(cause)
        throw cause
      } finally {
        setPending(false)
      }
    },
    [address, signMessage, invalidate]
  )

  return { batchResolveFailedEvents, isPending }
}
