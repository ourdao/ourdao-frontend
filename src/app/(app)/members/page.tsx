'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UsersRound, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'
import { LoadError } from '@/components/LoadError'
import { useAnnounceLoad } from '@/lib/useAnnounceLoad'
import { useMembers } from '@/hooks/useDAO'
import type { BackendMember } from '@/lib/backend'
import { formatToken } from '@/lib/utils'
import { formatStellarAddress } from '@/lib/stellar'

/** How many members the directory asks for per page. The backend's
 *  `/api/members` is a plain `LIMIT`, so "more" grows the page rather than
 *  walking a cursor. */
const PAGE_SIZE = 50

function MemberRow({ member }: { member: BackendMember }) {
  const name = member.name ?? formatStellarAddress(member.address)
  return (
    <li>
      <Link
        href={`/members/${encodeURIComponent(member.address)}`}
        className="flex items-center justify-between gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-600">
            <UsersRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">{name}</span>
              {member.has_active_loan && (
                <Badge variant="outline" className="shrink-0">
                  Active loan
                </Badge>
              )}
            </div>
            <span className="block truncate font-mono text-xs text-muted-foreground">
              {member.address}
            </span>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-6 text-sm sm:flex">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Joined</p>
            <p className="font-medium text-foreground">
              {member.joined_ledger != null ? `#${member.joined_ledger}` : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Staked</p>
            <p className="font-medium text-foreground">{formatToken(member.stake)}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
      </Link>
    </li>
  )
}

export default function MembersPage() {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const { members, isLoading, isError, refetch } = useMembers(limit)
  useAnnounceLoad('Members', isLoading, isError)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        subtitle="Active members of the DAO — addresses, join ledgers and stakes."
      />

      {/* Membership is public on-chain already; say so rather than implying this
          page newly exposes it. */}
      <Card className="border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <CardContent className="flex items-start gap-3 p-4">
          <UsersRound
            className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Membership is public: addresses, join ledgers and stakes are already visible on-chain.
            This directory makes them browsable, not newly public.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-20 rounded-lg" />
          ))}
        </div>
      ) : isError && members.length === 0 ? (
        <LoadError what="the member directory" onRetry={refetch} />
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <UsersRound className="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <h3 className="mb-2 text-lg font-medium text-foreground">No members yet</h3>
            <p className="text-muted-foreground">
              When members join the DAO they will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <ul className="space-y-3" aria-label="Active members">
            {members.map((member) => (
              <MemberRow key={member.address} member={member} />
            ))}
          </ul>
          {/* Only offer more when the current page filled up — otherwise the
              directory is already showing everything the backend has. */}
          {members.length >= limit && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                Show more members
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
