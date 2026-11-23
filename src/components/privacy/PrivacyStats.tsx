'use client'

import { ShieldCheckIcon } from '@/lib/icons'
import { useTreasuryProposals } from '@/hooks/useDAO'
import { LoadError } from '@/components/LoadError'

export function PrivacyStats() {
  const { proposals, isLoading, isError, refetch } = useTreasuryProposals()

  const privateCount = proposals.filter((p) => p.isPrivate).length
  const publicCount = proposals.length - privateCount

  return (
    <div className="bg-card border-border rounded-lg border p-6">
      <h3 className="text-foreground mb-4 flex items-center gap-2 text-lg font-semibold">
        <ShieldCheckIcon className="text-muted-foreground h-5 w-5" />
        Treasury proposal privacy, DAO-wide
      </h3>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : isError ? (
        <LoadError what="treasury proposal privacy counts" onRetry={refetch} />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {privateCount}
            </div>
            <div className="text-muted-foreground text-sm">Private proposals</div>
            <p className="text-muted-foreground mt-1 text-xs">
              Unvotable until commit/reveal UI ships.
            </p>
          </div>
          <div>
            <div className="text-foreground text-2xl font-bold">{publicCount}</div>
            <div className="text-muted-foreground text-sm">Public proposals</div>
          </div>
        </div>
      )}
    </div>
  )
}
