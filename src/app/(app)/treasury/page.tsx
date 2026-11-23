'use client'

import { useProposalFilters, type ProposalSortOrder } from '@/hooks/useProposalFilters'
import { calculateVotingWeight } from '@/hooks/dao/reads'
import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { InterestHistory } from '@/components/InterestHistory'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Banknote,
  Lock,
  TrendingUp,
  Gift,
  Upload,
  Download,
  Check,
  X,
  Landmark,
  TriangleAlert,
  Search,
} from 'lucide-react'
import {
  useUserData,
  useDAOStats,
  useStake,
  useStaking,
  useTreasuryProposals,
  useTreasuryVoting,
  useHasVoted,
  useToken,
  type UITreasuryProposal,
} from '@/hooks/useDAO'
import { LoadError } from '@/components/LoadError'
import { useAnnounceLoad } from '@/lib/useAnnounceLoad'
import { asBigInt } from '@/lib/dao-mappers'
import { parseToken } from '@/lib/utils'
import { AddressLink } from '@/components/AddressLink'
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_AWAITING_FUNDS } from '@/constants'
import { VirtualizedList } from '@/components/ui/virtualized-list'

function TreasuryProposalRow({
  proposal: p,
  canVote,
  voting,
  onVote,
}: {
  proposal: UITreasuryProposal
  canVote: boolean
  voting: boolean
  onVote: (proposalId: number, support: boolean) => Promise<unknown>
}) {
  const { hasVoted, refetch } = useHasVoted('Treasury', p.id, p.status === 2 && !p.isPrivate)
  const token = useToken()

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/treasury/${p.id}`}
              className="text-foreground font-medium hover:underline"
            >
              {p.title}
            </Link>
            {p.isPrivate && (
              <Badge variant="secondary" className="text-xs">
                Private · voting unavailable until commit-reveal
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {token.format(p.amount)} → <AddressLink address={p.recipient} />
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            For {p.votesFor} · Against {p.votesAgainst}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              p.status === 5
                ? 'default'
                : p.status === 4
                  ? 'destructive'
                  : p.status === PROPOSAL_STATUS_AWAITING_FUNDS
                    ? 'outline'
                    : 'secondary'
            }
          >
            {PROPOSAL_STATUS_LABELS[p.status as keyof typeof PROPOSAL_STATUS_LABELS]}
          </Badge>
          {canVote && p.status === 2 && !p.isPrivate && !hasVoted && (
            <div className="flex gap-1" role="group" aria-label="Vote">
              <Button
                size="sm"
                variant="outline"
                disabled={voting}
                onClick={async () => {
                  await onVote(p.id, true)
                  refetch()
                }}
                aria-label="Vote for"
              >
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={voting}
                onClick={async () => {
                  await onVote(p.id, false)
                  refetch()
                }}
                aria-label="Vote against"
              >
                <X className="h-4 w-4 text-red-600 dark:text-red-400" />
              </Button>
            </div>
          )}
          {canVote && p.status === 2 && !p.isPrivate && hasVoted && (
            <div className="text-muted-foreground flex items-center gap-1 text-sm">
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              You&apos;ve voted
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

export default function TreasuryPage() {
  const userData = useUserData()
  const stats = useDAOStats()
  const token = useToken()
  // `myStake` is null until the stake read succeeds; never treat that as 0 (#486).
  const { stake: myStake } = useStake()
  const stakeKnown = myStake !== null
  const { stake, unstake, isPending: staking } = useStaking()
  const { proposals, isLoading, hasMore, loadMore, isLoadingMore, hasErrors, isError, refetch } =
    useTreasuryProposals()
  const proposalFilters = useProposalFilters(proposals)

  const [amount, setAmount] = useState('')

  // Voting weight calculation (Issue #405)
  const enteredAmountStroops = (() => {
    try {
      const p = parseToken(amount, token.decimals)
      return p > BigInt(0) ? p : BigInt(0)
    } catch {
      return BigInt(0)
    }
  })()
  // #656: a failed balance read is not a zero balance; do not block staking on it.
  const hasInsufficientStakeBalance = !token.isError && enteredAmountStroops > token.balance
  const currentWeight = myStake === null ? null : calculateVotingWeight(myStake, token.decimals)
  const projectedWeight =
    myStake === null ? null : calculateVotingWeight(myStake + enteredAmountStroops, token.decimals)
  useAnnounceLoad('Treasury proposals', isLoading, isError)
  const { voteOnTreasury, isPending: voting } = useTreasuryVoting()

  if (!userData.isConnected) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Banknote className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="text-foreground mb-2 text-lg font-medium">Connect Your Wallet</h3>
            <p className="text-muted-foreground">
              Please connect your wallet to access the treasury.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleStake = async () => {
    const base = parseToken(amount, token.decimals)
    if (base <= BigInt(0) || base > token.balance) return
    try {
      await stake(base)
      token.refetch()
      setAmount('')
    } catch {
      /* toast handled in hook */
    }
  }

  const handleUnstake = async () => {
    const base = parseToken(amount, token.decimals)
    if (base <= BigInt(0)) return
    try {
      await unstake(base)
      token.refetch()
      setAmount('')
    } catch {
      /* toast handled in hook */
    }
  }

  const canVote = userData.isMember

  return (
    <>
      <PageHeader
        title="Treasury & Staking"
        subtitle="DAO funds, member staking, and treasury withdrawals"
      />
      {/* Overview */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Treasury Balance"
          value={token.format(stats.treasuryBalance)}
          loading={stats.isLoading}
          icon={Landmark}
          tint="bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400"
        />
        <StatCard
          label="Total Staked"
          value={token.format(stats.totalRestaked)}
          loading={stats.isLoading}
          icon={Lock}
          tint="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
        />
        <StatCard
          label="Your Stake"
          value={stakeKnown ? token.format(myStake) : 'Unavailable'}
          loading={stats.isLoading}
          icon={TrendingUp}
          tint="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
        />
        <StatCard
          label="Pending Yield"
          value={token.format(userData.pendingYield)}
          loading={stats.isLoading}
          icon={Gift}
          tint="bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/50 dark:text-fuchsia-400"
        />
      </div>

      {/* Lifetime Treasury Metrics */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Interest Collected"
          value={token.format(asBigInt(stats.interestCollected))}
          loading={stats.isLoading}
          icon={Gift}
          tint="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
        />
        <StatCard
          label="Principal Lent"
          value={token.format(asBigInt(stats.principalLent))}
          loading={stats.isLoading}
          icon={Banknote}
          tint="bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
        />
        <StatCard
          label="Principal Repaid"
          value={token.format(asBigInt(stats.principalRepaid))}
          loading={stats.isLoading}
          icon={TrendingUp}
          tint="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400"
        />
        <StatCard
          label="Value Defaulted"
          value={token.format(asBigInt(stats.valueDefaulted))}
          loading={stats.isLoading}
          icon={TriangleAlert}
          tint="bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Staking */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Staking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Stake tokens to boost your voting weight. Staked funds are held separately from the
              treasury and can be withdrawn at any time.
            </p>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="stake-amount" className="text-foreground block text-sm font-medium">
                  Amount ({token.symbol})
                </label>
                <span className="text-muted-foreground text-xs">
                  Balance: {token.isError ? 'Unavailable' : token.format(token.balance)}
                </span>
              </div>
              <input
                id="stake-amount"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={!userData.isMember || staking}
                className="border-input focus:border-primary-500 focus:ring-primary-500/20 disabled:bg-muted w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:ring-2 focus:outline-none"
              />
              {token.isError && (
                <p role="alert" className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  <span>Balance unavailable.</span>{' '}
                  <button type="button" className="underline" onClick={() => token.refetch()}>
                    Retry
                  </button>
                </p>
              )}
              {hasInsufficientStakeBalance && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                  Insufficient {token.symbol} balance ({token.format(token.balance)}).
                </p>
              )}
            </div>

            {/* Voting Weight Preview (Issue #405) */}
            <div className="border-border bg-muted/40 space-y-1 rounded-lg border p-3">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Current Voting Weight</span>
                <span className="text-foreground font-semibold">
                  {currentWeight === null
                    ? 'Unavailable'
                    : `${currentWeight} vote${currentWeight > 1 ? 's' : ''}`}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Projected Weight (after stake)</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {projectedWeight === null || currentWeight === null
                    ? 'Unavailable'
                    : `${projectedWeight} vote${projectedWeight > 1 ? 's' : ''}${
                        projectedWeight > currentWeight
                          ? ` (+${projectedWeight - currentWeight})`
                          : ''
                      }`}
                </span>
              </div>
              <p className="text-muted-foreground pt-1 text-[11px]">
                1 base vote + 1 bonus per 100 tokens staked (max 6 votes).
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleStake}
                disabled={
                  !userData.isMember ||
                  !stakeKnown ||
                  staking ||
                  !amount ||
                  hasInsufficientStakeBalance ||
                  stats.isPaused
                }
                className="flex-1"
              >
                <Upload className="mr-2 h-4 w-4" />
                {hasInsufficientStakeBalance ? 'Insufficient Balance' : 'Stake'}
              </Button>
              <Button
                variant="outline"
                onClick={handleUnstake}
                disabled={!userData.isMember || !stakeKnown || staking || !amount || stats.isPaused}
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                Unstake
              </Button>
            </div>
            {!userData.isMember && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                You must be a DAO member to stake.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Treasury proposals */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="text-primary-600 dark:text-primary-400 h-5 w-5" />
              Treasury Withdrawals
            </CardTitle>
          </CardHeader>
          {/* Filter and Search Controls (Issue #404) */}
          <div className="grid grid-cols-1 gap-3 px-6 pb-2 sm:grid-cols-3">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
              <input
                type="text"
                aria-label="Search treasury proposals"
                placeholder="Search proposals..."
                value={proposalFilters.filters.search}
                onChange={(e) => proposalFilters.setSearch(e.target.value)}
                className="border-input focus:ring-primary-500/20 w-full rounded-lg border py-1.5 pr-2.5 pl-8 text-xs focus:ring-2 focus:outline-none"
              />
            </div>
            <div>
              <select
                aria-label="Filter by Status"
                value={proposalFilters.filters.status}
                onChange={(e) => proposalFilters.setStatus(e.target.value)}
                className="border-input focus:ring-primary-500/20 w-full rounded-lg border px-2.5 py-1.5 text-xs focus:ring-2 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="2">In Voting</option>
                <option value="3">Approved</option>
                <option value="4">Rejected</option>
                <option value="5">Executed</option>
              </select>
            </div>
            <div>
              <select
                aria-label="Sort proposals"
                value={proposalFilters.filters.sort}
                onChange={(e) => proposalFilters.setSort(e.target.value as ProposalSortOrder)}
                className="border-input focus:ring-primary-500/20 w-full rounded-lg border px-2.5 py-1.5 text-xs focus:ring-2 focus:outline-none"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="amount_high">Highest Amount</option>
                <option value="amount_low">Lowest Amount</option>
              </select>
            </div>
          </div>
          <CardContent>
            {hasErrors && (
              <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300">
                Some treasury proposals couldn&apos;t be loaded and are missing from this list. Try
                again shortly.
              </div>
            )}
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="skeleton h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : isError && proposalFilters.filteredItems.length === 0 ? (
              <LoadError what="treasury proposals" onRetry={refetch} />
            ) : proposalFilters.filteredItems.length === 0 ? (
              <div className="py-10 text-center">
                <Banknote className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
                <p className="text-muted-foreground">No treasury withdrawals yet.</p>
              </div>
            ) : (
              <VirtualizedList
                items={proposalFilters.filteredItems}
                threshold={50}
                itemHeight={120}
                className="divide-border divide-y"
                listAriaLabel="Treasury withdrawals"
                keyExtractor={(p) => p.id}
                renderItem={(p) => (
                  <TreasuryProposalRow
                    proposal={p}
                    canVote={canVote}
                    voting={voting || stats.isPaused}
                    onVote={voteOnTreasury}
                  />
                )}
              />
            )}
            {!isLoading && hasMore && (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" onClick={() => loadMore()} disabled={isLoadingMore}>
                  {isLoadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Interest Distribution History */}
        <InterestHistory />
      </div>
    </>
  )
}
