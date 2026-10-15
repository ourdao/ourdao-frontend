'use client'

import { useLoanTimeline, useTreasuryTimeline, eventLabel } from '@/hooks/useDAO'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CalendarIcon, Clock, CheckCircle, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface ProposalTimelineProps {
  kind: 'loan' | 'treasury'
  id: number
  fallbackDates?: {
    created?: number | string
    votingStart?: number | string
    votingEnd?: number | string
    disbursed?: number | string
  }
}

export function ProposalTimeline({ kind, id, fallbackDates }: ProposalTimelineProps) {
  const loanTimeline = useLoanTimeline(kind === 'loan' ? id : 0)
  const treasuryTimeline = useTreasuryTimeline(kind === 'treasury' ? id : 0)

  const { timeline, isLoading } = kind === 'loan' ? loanTimeline : treasuryTimeline

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <CalendarIcon className="h-5 w-5 mr-2" />
            Proposal Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading timeline events...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <CalendarIcon className="h-5 w-5 mr-2" />
          Proposal Timeline
        </CardTitle>
        <CardDescription>Decoded on-chain event sequence</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {timeline && timeline.length > 0 ? (
          <div className="relative border-l border-border ml-3 pl-4 space-y-4">
            {timeline.map((ev, idx) => (
              <div key={`${ev.symbol}-${ev.ledger}-${idx}`} className="relative">
                <span className="absolute -left-[23px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/30">
                  <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                </span>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {eventLabel(ev.symbol)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Ledger {ev.ledger}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(ev.created_at)}
                  </span>
                  {ev.tx_hash && (
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${ev.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                    >
                      Tx {ev.tx_hash.slice(0, 8)}... <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : fallbackDates ? (
          <div className="space-y-3">
            {fallbackDates.created && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">{formatDate(fallbackDates.created)}</span>
              </div>
            )}
            {fallbackDates.votingStart && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Voting Started</span>
                <span className="font-medium">{formatDate(fallbackDates.votingStart)}</span>
              </div>
            )}
            {fallbackDates.votingEnd && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Voting Ends</span>
                <span className="font-medium">{formatDate(fallbackDates.votingEnd)}</span>
              </div>
            )}
            {fallbackDates.disbursed && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Disbursed</span>
                <span className="font-medium">{formatDate(fallbackDates.disbursed)}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No timeline events recorded yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
