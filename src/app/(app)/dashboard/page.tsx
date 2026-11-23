'use client'

import { useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConnectButton } from '@/components/ConnectButton'
import Link from 'next/link'
import {
  BanknotesIcon,
  UsersIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ArrowUpRightIcon,
  TrophyIcon,
} from '@/lib/icons'
import { useDAOStats, useUserData, useRewards, useDAOEvents, eventLabel } from '@/hooks/useDAO'
import { useRequireMember } from '@/hooks/useRequireMember'
import { LoadError } from '@/components/LoadError'
import { useAnnounceLoad } from '@/lib/useAnnounceLoad'
import { formatToken, formatDate } from '@/lib/utils'
import { AddressLink } from '@/components/AddressLink'
import { MEMBER_STATUS_LABELS, NON_MEMBER_LABEL } from '@/constants'
import toast from 'react-hot-toast'
import { useIsMobile, useResponsiveCardLayout } from '@/lib/responsive'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/PageHeader'

export default function DashboardPage() {
  const stats = useDAOStats()
  const userData = useUserData()
  const { claimRewards, isPending, isSuccess } = useRewards()
  const { events, isError: eventsError, refetch: refetchEvents } = useDAOEvents()
  // The redirect decision lives in the shared guard (#307) so it waits for the
  // wallet restore *and* the membership read before acting. Previously the
  // effect below only checked the query's isLoading, which is false during the
  // window where the wallet hasn't reported an address yet — so a hard refresh
  // could send a connected member to /register (#69, #307).
  const { isResolving } = useRequireMember({ userData })
  useAnnounceLoad('Dashboard', userData.isLoading, !!userData.isError)
  const isMobile = useIsMobile()
  const { getCardGridClass } = useResponsiveCardLayout()

  useEffect(() => {
    if (isSuccess) {
      toast.success('Yield claimed successfully!')
    }
  }, [isSuccess])

  const handleClaimYield = async () => {
    await claimRewards()
  }

  // The "not connected" card is only correct once the restore attempt has
  // settled; before that, `isConnected` is false for a wallet that is connected.
  if (isResolving) {
    // Same "not yet known" collapse as isAdmin on the admin panel (#69) —
    // isMember reads false until the query resolves, which would otherwise
    // redirect to /register and flash the "Not a Member" card on every
    // load. No AppShell wrapper needed — the (app) route-group layout
    // already provides it.
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!userData.isConnected) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Access Dashboard</CardTitle>
            <CardDescription>Connect your wallet to access the member dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <Button onClick={openConnectModal} className="w-full" size="lg">
                  Connect Wallet
                </Button>
              )}
            </ConnectButton.Custom>
            <div className="text-center">
              <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
                ← Back to Home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (userData.isError) {
    return (
      <div className="mx-auto mt-8 max-w-md">
        <LoadError what="your membership data" onRetry={userData.refetch} />
      </div>
    )
  }

  if (!userData.isMember) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Not a Member</CardTitle>
            <CardDescription>You need to be a DAO member to access the dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild className="w-full" size="lg">
              <Link href="/register">Join the DAO</Link>
            </Button>
            <div className="text-center">
              <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
                ← Back to Home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const quickActions = [
    {
      title: 'Request Loan',
      description: 'Submit a new loan proposal',
      icon: BanknotesIcon,
      href: '/loans/request',
      color: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'View Loans',
      description: 'Browse and vote on loan proposals',
      icon: UsersIcon,
      href: '/loans',
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Governance',
      description: 'Vote on proposals and participate in DAO decisions',
      icon: ChartBarIcon,
      href: '/governance',
      color: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      title: 'Treasury',
      description: 'View treasury status and restaking',
      icon: ChartBarIcon,
      href: '/treasury',
      color: 'text-purple-600 dark:text-purple-400',
    },
    {
      title: 'Privacy Settings',
      description: 'Manage privacy preferences',
      icon: ShieldCheckIcon,
      href: '/privacy',
      color: 'text-yellow-600 dark:text-yellow-400',
    },
    ...(userData.isAdmin
      ? [
          {
            title: 'Admin Panel',
            description: 'Manage DAO operations and configuration',
            icon: ShieldCheckIcon,
            href: '/admin',
            color: 'text-red-600 dark:text-red-400',
          },
        ]
      : []),
  ]

  const memberStatusColor =
    userData.member?.status === 1 ? 'text-green-600' : 'text-muted-foreground'
  const memberStatusBg = userData.member?.status === 1 ? 'bg-green-50' : 'bg-muted'

  return (
    <>
      <PageHeader
        title="Member Dashboard"
        subtitle="Your membership, rewards, and activity at a glance"
      />
      {/* Member Status */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`rounded-full p-3 ${memberStatusBg}`}>
                  <CheckCircleIcon className={`h-8 w-8 ${memberStatusColor}`} />
                </div>
                <div>
                  <h3 className="text-foreground text-lg font-semibold">
                    <AddressLink address={userData.address || ''} />
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Status:{' '}
                    {userData.member
                      ? MEMBER_STATUS_LABELS[userData.member.status]
                      : NON_MEMBER_LABEL}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Member since: {formatDate(userData.member?.joinDate || 0)}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-muted-foreground text-sm">Voting Weight</div>
                <div className="text-foreground text-2xl font-bold">
                  {userData.votingWeight ?? '—'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={`grid grid-cols-1 ${isMobile ? 'gap-4' : 'gap-8 lg:grid-cols-3'}`}>
        {/* Main Content */}
        <div className={`${isMobile ? 'space-y-4' : 'space-y-8 lg:col-span-2'}`}>
          {/* Stats Cards */}
          <div className={`grid ${getCardGridClass(3)} gap-3 sm:gap-6`}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="mr-4 rounded-full bg-blue-50 p-3 dark:bg-blue-950/50">
                    <CurrencyDollarIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Share Balance</p>
                    <p className="text-foreground text-2xl font-bold">
                      {formatToken(userData.member?.shareBalance || BigInt(0))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="mr-4 rounded-full bg-purple-50 p-3 dark:bg-purple-950/50">
                    <ChartBarIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Claimable Yield</p>
                    <p className="text-foreground text-2xl font-bold">
                      {formatToken(userData.pendingYield)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="mr-4 rounded-full bg-yellow-50 p-3 dark:bg-yellow-950/50">
                    <BanknotesIcon
                      className={`h-8 w-8 ${userData.hasActiveLoan ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}
                    />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Active Loan</p>
                    <p className="text-foreground text-2xl font-bold">
                      {userData.hasActiveLoan ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rewards Section */}
          {userData.pendingYield > BigInt(0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrophyIcon className="mr-2 h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  Claimable Yield
                </CardTitle>
                <CardDescription>You have yield available to claim</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg bg-purple-50 p-4 dark:bg-purple-950/30">
                  <div>
                    <p className="font-medium text-purple-900 dark:text-purple-300">Yield</p>
                    <p className="text-sm text-purple-700 dark:text-purple-400">
                      {formatToken(userData.pendingYield)}
                    </p>
                  </div>
                  <Button
                    onClick={handleClaimYield}
                    disabled={isPending || stats.isPaused}
                    size="sm"
                  >
                    {isPending ? 'Claiming...' : 'Claim'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and features you can access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Link key={action.title} href={action.href}>
                      <div className="border-border hover:border-input cursor-pointer rounded-lg border p-4 transition-all hover:shadow-sm">
                        <div className="flex items-start space-x-3">
                          <Icon className={`h-6 w-6 ${action.color} mt-1`} />
                          <div>
                            <h3 className="text-foreground font-medium">{action.title}</h3>
                            <p className="text-muted-foreground text-sm">{action.description}</p>
                          </div>
                          <ArrowUpRightIcon className="text-muted-foreground ml-auto h-4 w-4" />
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className={`${isMobile ? 'space-y-4' : 'space-y-8'}`}>
          {/* DAO Overview */}
          <Card>
            <CardHeader>
              <CardTitle>DAO Overview</CardTitle>
              <CardDescription>Current DAO statistics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Total Members</span>
                <span className="font-medium">{stats.totalMembers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Active Members</span>
                <span className="font-medium">{stats.activeMembers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Treasury Balance</span>
                <span className="font-medium">{formatToken(stats.treasuryBalance)}</span>
              </div>
              {stats.totalYieldGenerated > BigInt(0) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Total Yield</span>
                  <span className="font-medium">{formatToken(stats.totalYieldGenerated)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feature Status */}
          <Card>
            <CardHeader>
              <CardTitle>Feature Status</CardTitle>
              <CardDescription>Available DAO features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">ENS Voting</span>
                <div
                  className={`h-2 w-2 rounded-full ${stats.features.ensVoting ? 'bg-green-500' : 'bg-muted-foreground'}`}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Document Storage</span>
                <div
                  className={`h-2 w-2 rounded-full ${stats.features.documentStorage ? 'bg-green-500' : 'bg-muted-foreground'}`}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Private Voting</span>
                <div
                  className={`h-2 w-2 rounded-full ${stats.features.privateVoting ? 'bg-green-500' : 'bg-muted-foreground'}`}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Confidential Loans</span>
                <div
                  className={`h-2 w-2 rounded-full ${stats.features.confidentialLoans ? 'bg-green-500' : 'bg-muted-foreground'}`}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Restaking</span>
                <div
                  className={`h-2 w-2 rounded-full ${stats.features.restaking ? 'bg-green-500' : 'bg-muted-foreground'}`}
                />
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest DAO events</CardDescription>
            </CardHeader>
            <CardContent>
              {eventsError ? (
                <LoadError what="recent activity" onRetry={() => void refetchEvents()} />
              ) : events.length > 0 ? (
                <div className="space-y-3">
                  {events.slice(0, 5).map((event, index) => (
                    <div key={index} className="flex items-center space-x-3 text-sm">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="text-muted-foreground">{eventLabel(event?.symbol)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No recent activity</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
