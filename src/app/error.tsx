'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { MAIN_CONTENT_ID } from '@/lib/a11y'
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
 * Route-segment error boundary. Without this, an uncaught render error
 * anywhere below the root layout unmounts the whole app with no way to
 * recover short of a hard reload — this gives React a place to catch it and
 * offers a retry that doesn't lose the rest of the app's state (wallet
 * connection, query cache, etc).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { reset: resetQueries } = useQueryErrorResetBoundary()
  const referenceId = getReferenceId(error)

  useEffect(() => {
    logger.error('Route error boundary caught', { error, referenceId })
    // Subject to the member's error-reporting opt-in (#247) — see
    // src/lib/error-reporting.ts. `digest` is Next.js's own reference id
    // for this error occurrence, safe to include as-is.
    reportError(error, { boundary: 'route', digest: error.digest, referenceId })
  }, [error, referenceId])

  return (
    <main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      className="bg-background flex min-h-screen items-center justify-center px-4 focus:outline-none"
    >
      <div className="border-border bg-card text-card-foreground w-full max-w-md rounded-xl border p-6 text-center shadow-sm">
        <h1 className="text-foreground text-lg font-semibold">This page couldn&apos;t load</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Something went wrong rendering this page. You can try again, or head back to the
          dashboard.
        </p>
        <p
          className="text-muted-foreground mt-2 font-mono text-xs"
          data-testid="error-reference-id"
        >
          Reference: {referenceId}
        </p>
        {process.env.NODE_ENV !== 'production' && error.message && (
          <p
            className="bg-muted text-muted-foreground mt-3 rounded-lg p-2 font-mono text-xs break-words"
            data-testid="dev-error-message"
          >
            {error.message}
          </p>
        )}
        <div className="mt-5 flex justify-center gap-2">
          <Button
            onClick={() => {
              // A boundary that was tripped by a failed query re-throws the
              // cached error on remount unless the query error is reset too.
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
    </main>
  )
}
