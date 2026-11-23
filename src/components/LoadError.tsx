import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LoadErrorProps {
  /** What failed to load, e.g. "loan proposals". */
  what: string
  onRetry?: () => void
  className?: string
}

/**
 * The "failed to load" counterpart to an empty state. A list that failed to
 * fetch must never render as "nothing here" — the member cannot tell an empty
 * DAO from an unreachable RPC or indexer. `role="alert"` announces it
 * assertively, since a failure should interrupt.
 */
export function LoadError({ what, onRetry, className }: LoadErrorProps) {
  return (
    <div
      role="alert"
      data-testid="load-error"
      className={`border-destructive/40 bg-destructive/10 flex flex-col items-center gap-3 rounded-lg border p-6 text-center ${className ?? ''}`}
    >
      <TriangleAlert className="text-destructive h-6 w-6" aria-hidden="true" />
      <p className="text-foreground text-sm font-medium">Couldn&apos;t load {what}.</p>
      <p className="text-muted-foreground text-xs">
        This is a loading problem, not an empty list. Check your connection and try again.
      </p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
