'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'

function getReferenceId(error: Error & { digest?: string }): string {
  if (error.digest) return error.digest
  const str = error.message || error.name || 'unknown'
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return `ERR_${Math.abs(hash).toString(16).padStart(6, '0')}`
}

/**
 * Error boundary for everything inside the app shell. Unlike the root
 * error.tsx (which replaces the whole page), this renders *inside* AppShell's
 * <main>, so the header, navigation and wallet stay usable — the member can
 * retry or navigate elsewhere without a reload.
 *
 * This is where a failed *primary* query lands: createQueryClient makes any
 * query marked `meta.boundary` throw here. Resetting the query error boundary
 * before Next's `reset()` is what makes "Try again" actually refetch —
 * without it the cached error is re-thrown on remount and the boundary
 * immediately trips again.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { reset: resetQueries } = useQueryErrorResetBoundary()
  const referenceId = getReferenceId(error)

  useEffect(() => {
    logger.error('App route error boundary caught', { error, referenceId })
    reportError(error, { boundary: 'app-route', digest: error.digest, referenceId })
  }, [error, referenceId])

  return (
    <div
      role="alert"
      className="mx-auto mt-8 w-full max-w-md rounded-xl border border-border bg-card p-6 text-center text-card-foreground shadow-sm"
    >
      <TriangleAlert className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
      <h1 className="mt-3 text-lg font-semibold text-foreground">This page couldn&apos;t load</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The data for this page failed to load. That is a loading problem, not
        an empty result — nothing here has been lost.
      </p>
      <p className="mt-2 text-xs font-mono text-muted-foreground" data-testid="error-reference-id">
        Reference: {referenceId}
      </p>
      {process.env.NODE_ENV !== 'production' && error.message && (
        <p className="mt-3 break-words rounded-lg bg-muted p-2 font-mono text-xs text-muted-foreground" data-testid="dev-error-message">
          {error.message}
        </p>
      )}
      <div className="mt-5 flex justify-center gap-2">
        <Button
          onClick={() => {
            resetQueries()
            reset()
          }}
        >
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
