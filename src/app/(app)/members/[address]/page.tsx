'use client'

import { useParams } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { useMemberSummary, useMemberActivity, useMemberOverview, eventLabel } from '@/hooks/useDAO'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatToken, formatDate } from '@/lib/utils'
import { formatStellarAddress, getAddressUrl } from '@/lib/stellar'
import { User, Coins, Layers, Clock, ExternalLink, CreditCard, Bell } from 'lucide-react'

export default function MemberProfilePage() {
  const params = useParams()
  const rawAddress = (params.address as string) || ''
  const address = decodeURIComponent(rawAddress)

  const { summary } = useMemberSummary(address)
  // #644: single overview read from the contract (member record, stake, yield, name, delegate).
  const { overview, isLoading: isOverviewLoading } = useMemberOverview(address)
  const { activity, isLoading: isActivityLoading } = useMemberActivity(address, 50)

  // Non-member guard: show a clear state when the contract confirms this
  // address is not a DAO member (overview loaded, isMember explicitly false).
  const isNotMember = !isOverviewLoading && overview?.isMember === false

  if (isNotMember) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Member Profile"
          subtitle={`${formatStellarAddress(address)} is not a DAO member`}
        />
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              This address has not joined the DAO. If you believe this is an error, the member may
              have exited or not yet registered.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Member Profile`}
        subtitle={`Summary snapshot and on-chain activity for ${formatStellarAddress(address)}`}
      />

      {/* Profile Overview Card */}
      <Card className="border-border border">
        <CardContent className="pt-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary-600 flex h-12 w-12 items-center justify-center rounded-full">
                <User className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-foreground font-mono text-base font-semibold break-all">
                    {address}
                  </h3>
                  {summary?.is_active ? (
                    <Badge variant="default" className="bg-emerald-600">
                      Active Member
                    </Badge>
                  ) : (
                    <Badge variant="outline">Member</Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Joined: {summary?.joined_at ? formatDate(summary.joined_at) : 'Active'}
                </p>
                {overview?.name && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Name: <span className="font-medium text-foreground">{overview.name}</span>
                  </p>
                )}
                {overview?.delegate && overview.delegate !== address && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Delegating to:{' '}
                    <span className="font-mono font-medium text-foreground">
                      {formatStellarAddress(overview.delegate)}
                    </span>
                  </p>
                )}
              </div>
            </div>
            {(() => {
              const explorerUrl = getAddressUrl(address)
              return explorerUrl ? (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  View on Explorer <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </a>
              ) : null
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Voting Shares</CardTitle>
            <Layers className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? `${(summary.shares_bps / 100).toFixed(2)}%` : '—'}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {summary?.shares_bps ?? 0} basis points
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staked Balance</CardTitle>
            <Coins className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? formatToken(BigInt(summary.staked_amount || 0)) : '—'}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">Staked governance tokens</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loans History</CardTitle>
            <CreditCard className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.loans_count ?? 0}</div>
            <p className="text-muted-foreground mt-1 text-xs">
              {summary?.active_loans_count ?? 0} currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unread Notifications</CardTitle>
            <Bell className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.unread_notifications ?? 0}</div>
            <p className="text-muted-foreground mt-1 text-xs">Pending alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Member Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Member Activity Feed
          </CardTitle>
          <CardDescription>Recent on-chain events associated with this address</CardDescription>
        </CardHeader>
        <CardContent>
          {isActivityLoading ? (
            <p className="text-muted-foreground text-sm">Loading activity...</p>
          ) : activity.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No recent activity recorded for this member.
            </p>
          ) : (
            <div className="divide-border divide-y">
              {activity.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {ev.symbol}
                    </Badge>
                    <span className="text-foreground text-sm">{eventLabel(ev.symbol)}</span>
                    <span className="text-muted-foreground text-xs">Ledger {ev.ledger}</span>
                  </div>
                  <span className="text-muted-foreground text-xs">{formatDate(ev.closed_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
