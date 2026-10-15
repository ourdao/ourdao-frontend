'use client'

import { useParams } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { useMemberSummary, useMemberActivity, eventLabel } from '@/hooks/useDAO'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatToken, formatDate } from '@/lib/utils'
import { formatStellarAddress } from '@/lib/stellar'
import {
  User,
  ShieldCheck,
  Coins,
  Layers,
  Clock,
  ExternalLink,
  CreditCard,
  Bell,
} from 'lucide-react'

export default function MemberProfilePage() {
  const params = useParams()
  const rawAddress = (params.address as string) || ''
  const address = decodeURIComponent(rawAddress)

  const { summary, isLoading: isSummaryLoading } = useMemberSummary(address)
  const { activity, isLoading: isActivityLoading } = useMemberActivity(address, 50)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Member Profile`}
        subtitle={`Summary snapshot and on-chain activity for ${formatStellarAddress(address)}`}
      />

      {/* Profile Overview Card */}
      <Card className="border border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary-600">
                <User className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-mono text-base font-semibold text-foreground break-all">
                    {address}
                  </h3>
                  {summary?.is_active ? (
                    <Badge variant="default" className="bg-emerald-600">Active Member</Badge>
                  ) : (
                    <Badge variant="outline">Member</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Joined: {summary?.joined_at ? formatDate(summary.joined_at) : 'Active'}
                </p>
              </div>
            </div>
            <a
              href={`https://stellar.expert/explorer/testnet/account/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              View on Explorer <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Voting Shares</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? `${(summary.shares_bps / 100).toFixed(2)}%` : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.shares_bps ?? 0} basis points
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staked Balance</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? formatToken(BigInt(summary.staked_amount || 0)) : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Staked governance tokens</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loans History</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.loans_count ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.active_loans_count ?? 0} currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unread Notifications</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.unread_notifications ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pending alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Member Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Member Activity Feed
          </CardTitle>
          <CardDescription>Recent on-chain events associated with this address</CardDescription>
        </CardHeader>
        <CardContent>
          {isActivityLoading ? (
            <p className="text-sm text-muted-foreground">Loading activity...</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity recorded for this member.</p>
          ) : (
            <div className="divide-y divide-border">
              {activity.map((ev) => (
                <div key={ev.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {ev.symbol}
                    </Badge>
                    <span className="text-sm text-foreground">
                      {eventLabel(ev.symbol)}
                    </span>
                    <span className="text-xs text-muted-foreground">Ledger {ev.ledger}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(ev.closed_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
