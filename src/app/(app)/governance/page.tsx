'use client'

import { useProposalFilters } from '@/hooks/useProposalFilters'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  UsersIcon,
  UserGroupIcon,
  ScaleIcon,
  DocumentTextIcon,
  DocumentPlusIcon,
  CheckIcon,
  XMarkIcon,
  BanknotesIcon,
} from '@/lib/icons'
import {
  useUserData,
  useDAOStats,
  useLoanProposals,
  useTreasuryProposals,
  useVoting,
  useTreasuryVoting,
  useHasVoted,
  useExpireLoanProposal,
  useExpireTreasuryProposal,
  type UILoanProposal,
  type UITreasuryProposal,
} from '@/hooks/useDAO'
import { LoadError } from '@/components/LoadError'
import { useAnnounceLoad } from '@/lib/useAnnounceLoad'
import { formatToken, formatThreshold } from '@/lib/utils'
import { AddressLink } from '@/components/AddressLink'
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_AWAITING_FUNDS, GOVERNANCE_PERIOD_FALLBACKS } from '@/constants'
import { VirtualizedList } from '@/components/ui/virtualized-list'
import { useNow } from '@/hooks/useNow'

function StatusBadge({ status }: { status: number }) {
  const variant =
    status === 3 || status === 5
      ? 'default'
      : status === 4
        ? 'destructive'
        : status === PROPOSAL_STATUS_AWAITING_FUNDS
          ? 'outline'
          : 'secondary'
  return (
    <Badge variant={variant}>
      {PROPOSAL_STATUS_LABELS[status as keyof typeof PROPOSAL_STATUS_LABELS]}
    </Badge>
  )
}

function VoteButtons({
  disabled,
  onVote,
}: {
  disabled: boolean
  onVote: (support: boolean) => void
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Vote">
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => onVote(true)}
        aria-label="Vote for"
      >
        <CheckIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => onVote(false)}
        aria-label="Vote against"
      >
        <XMarkIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
      </Button>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-12 text-center">
      <DocumentTextIcon className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
      <p className="text-muted-foreground">{label}</p>
    </div>
  )
}

function AlreadyVotedLabel() {
  return (
    <div className="text-muted-foreground flex items-center gap-1 text-sm">
      <CheckIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      You&apos;ve voted
    </div>
  )
}

function LoanProposalRow({
  proposal: p,
  canVote,
  votingLoan,
  now,
  onVote,
  onFinalize,
  finalizing,
}: {
  proposal: UILoanProposal
  canVote: boolean
  votingLoan: boolean
  now: number | null
  onVote: (proposalId: number, support: boolean) => Promise<unknown>
  onFinalize: (proposalId: number) => Promise<unknown>
  finalizing: boolean
}) {
  const { hasVoted, refetch } = useHasVoted('Loan', p.id, p.status === 2)

  // A loan proposal can be finalized when status is still Pending (status=2 or 1)
  // and the voting window has closed: now > editingPeriodEnd + votingPeriod.
  // `p.votingEndTime` already encodes editingPeriodEnd + votingPeriod.
  const canFinalize =
    now !== null &&
    p.status === 2 &&
    p.votingEndTime > 0 &&
    Math.floor(now / 1000) > p.votingEndTime

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-4">
      <div className="min-w-0">
        <Link
          href={`/loans/${p.id}`}
          className="text-foreground hover:text-primary-700 dark:hover:text-primary-400 font-medium"
        >
          Loan Proposal #{p.id}
        </Link>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {formatToken(p.amount)} · {(p.interestRate / 100).toFixed(1)}% ·{' '}
          <AddressLink address={p.borrower} />
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          For {p.votesFor} · Against {p.votesAgainst}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={p.status} />
        {canVote && p.status === 2 && !hasVoted && (
          <VoteButtons
            disabled={votingLoan}
            onVote={async (s) => {
              await onVote(p.id, s)
              refetch()
            }}
          />
        )}
        {canVote && p.status === 2 && hasVoted && <AlreadyVotedLabel />}
        {canFinalize && (
          <Button size="sm" variant="outline" disabled={finalizing} onClick={() => onFinalize(p.id)}>
            Finalize
          </Button>
        )}
      </div>
    </li>
  )
}

function TreasuryProposalRow({
  proposal: p,
  canVote,
  votingTreasury,
  now,
  onVote,
  onFinalize,
  finalizing,
}: {
  proposal: UITreasuryProposal
  canVote: boolean
  votingTreasury: boolean
  now: number | null
  onVote: (proposalId: number, support: boolean) => Promise<unknown>
  onFinalize: (proposalId: number) => Promise<unknown>
  finalizing: boolean
}) {
  const { hasVoted, refetch } = useHasVoted('Treasury', p.id, p.status === 2 && !p.isPrivate)

  // For private proposals, the commit-reveal window is 2× the voting period,
  // so only offer Finalize after both windows have elapsed.
  const finalizeWindowSec = p.isPrivate
    ? 2 * GOVERNANCE_PERIOD_FALLBACKS.votingPeriod
    : GOVERNANCE_PERIOD_FALLBACKS.votingPeriod
  const canFinalize =
    now !== null &&
    p.status === 2 &&
    p.creationTime > 0 &&
    Math.floor(now / 1000) > p.creationTime + finalizeWindowSec

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-foreground font-medium">{p.title}</p>
          {p.isPrivate && (
            <Badge variant="secondary" className="text-xs">
              Private · voting unavailable until commit-reveal
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {formatToken(p.amount)} → <AddressLink address={p.recipient} />
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          For {p.votesFor} · Against {p.votesAgainst}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={p.status} />
        {canVote && p.status === 2 && !p.isPrivate && !hasVoted && (
          <VoteButtons
            disabled={votingTreasury}
            onVote={async (s) => {
              await onVote(p.id, s)
              refetch()
            }}
          />
        )}
        {canVote && p.status === 2 && !p.isPrivate && hasVoted && <AlreadyVotedLabel />}
        {canFinalize && (
          <Button size="sm" variant="outline" disabled={finalizing} onClick={() => onFinalize(p.id)}>
            Finalize
          </Button>
        )}
      </div>
    </li>
  )
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-20 w-full rounded-lg" />
      ))}
    </div>
  )
}

export default function GovernancePage() {
  const userData = useUserData()
  const stats = useDAOStats()
  const {
    proposals: loanProposals,
    isLoading: loadingLoans,
    hasMore: hasMoreLoans,
    loadMore: loadMoreLoans,
    isLoadingMore: loadingMoreLoans,
    hasErrors: loanErrors,
    isError: loanFailed,
    refetch: refetchLoans,
  } = useLoanProposals()
  const {
    proposals: treasuryProposals,
    isLoading: loadingTreasury,
    hasMore: hasMoreTreasury,
    loadMore: loadMoreTreasury,
    isLoadingMore: loadingMoreTreasury,
    hasErrors: treasuryErrors,
    isError: treasuryFailed,
    refetch: refetchTreasury,
  } = useTreasuryProposals()
  useAnnounceLoad('Loan proposals', loadingLoans, loanFailed)
  useAnnounceLoad('Treasury proposals', loadingTreasury, treasuryFailed)
  const { voteOnProposal, isPending: votingLoan } = useVoting()
  const { voteOnTreasury, isPending: votingTreasury } = useTreasuryVoting()
  const { expireLoanProposal, isPending: finalizingLoan } = useExpireLoanProposal()
  const { expireTreasuryProposal, isPending: finalizingTreasury } = useExpireTreasuryProposal()
  const now = useNow()

  const loanFilters = useProposalFilters(loanProposals)
  const treasuryFilters = useProposalFilters(treasuryProposals)

  if (!userData.isConnected) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <ScaleIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="text-foreground mb-2 text-lg font-medium">Connect Your Wallet</h3>
            <p className="text-muted-foreground">
              Please connect your wallet to access governance.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const thresholdPct = formatThreshold(stats.consensusThreshold || 0)
  const openProposals =
    loanProposals.filter((p) => p.status === 2).length +
    treasuryProposals.filter((p) => p.status === 2).length

  return (
    <>
      <PageHeader
        title="Governance"
        subtitle="Vote on loan requests and treasury withdrawals"
        actions={
          userData.isMember ? (
            <Button asChild size="sm">
              <Link href="/governance/create">
                <DocumentPlusIcon className="mr-2 h-4 w-4" />
                Create Proposal
              </Link>
            </Button>
          ) : undefined
        }
      />
      {/* Overview */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Members"
          value={stats.totalMembers}
          icon={UsersIcon}
          tint="bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400"
        />
        <StatCard
          label="Active Members"
          value={stats.activeMembers}
          icon={UserGroupIcon}
          tint="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
        />
        <StatCard
          label="Consensus Threshold"
          value={thresholdPct}
          icon={ScaleIcon}
          tint="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
        />
        <StatCard
          label="Open Proposals"
          value={openProposals}
          icon={DocumentTextIcon}
          tint="bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/50 dark:text-fuchsia-400"
        />
      </div>

      <Tabs defaultValue="loans" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="loans">Loan Proposals</TabsTrigger>
          <TabsTrigger value="treasury">Treasury</TabsTrigger>
        </TabsList>

        {/* Loan proposals */}
        <TabsContent value="loans" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BanknotesIcon className="text-primary-600 dark:text-primary-400 h-5 w-5" />
                Loan Proposals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loanErrors && (
                <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300">
                  Some loan proposals couldn&apos;t be loaded and are missing from this list. Try
                  again shortly.
                </div>
              )}
              {loadingLoans ? (
                <LoadingRows />
              ) : loanFailed && loanFilters.filteredItems.length === 0 ? (
                <LoadError what="loan proposals" onRetry={refetchLoans} />
              ) : loanFilters.filteredItems.length === 0 ? (
                <EmptyState label="No loan proposals yet." />
              ) : (
                <VirtualizedList
                  items={loanFilters.filteredItems}
                  threshold={50}
                  itemHeight={120}
                  className="divide-border divide-y"
                  listAriaLabel="Loan proposals"
                  keyExtractor={(p) => p.id}
                  renderItem={(p) => (
                    <LoanProposalRow
                      proposal={p}
                      canVote={userData.isMember}
                      votingLoan={votingLoan || stats.isPaused}
                      now={now}
                      onVote={voteOnProposal}
                      onFinalize={expireLoanProposal}
                      finalizing={finalizingLoan || stats.isPaused}
                    />
                  )}
                />
              )}
              {!loadingLoans && hasMoreLoans && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => loadMoreLoans()}
                    disabled={loadingMoreLoans}
                  >
                    {loadingMoreLoans ? 'Loading…' : 'Load more'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Treasury proposals */}
        <TabsContent value="treasury" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BanknotesIcon className="text-primary-600 dark:text-primary-400 h-5 w-5" />
                Treasury Withdrawals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {treasuryErrors && (
                <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300">
                  Some treasury proposals couldn&apos;t be loaded and are missing from this list.
                  Try again shortly.
                </div>
              )}
              {loadingTreasury ? (
                <LoadingRows />
              ) : treasuryFailed && treasuryFilters.filteredItems.length === 0 ? (
                <LoadError what="treasury proposals" onRetry={refetchTreasury} />
              ) : treasuryFilters.filteredItems.length === 0 ? (
                <EmptyState label="No treasury withdrawals yet." />
              ) : (
                <VirtualizedList
                  items={treasuryFilters.filteredItems}
                  threshold={50}
                  itemHeight={120}
                  className="divide-border divide-y"
                  listAriaLabel="Treasury proposals"
                  keyExtractor={(p) => p.id}
                  renderItem={(p) => (
                    <TreasuryProposalRow
                      proposal={p}
                      canVote={userData.isMember}
                      votingTreasury={votingTreasury || stats.isPaused}
                      now={now}
                      onVote={voteOnTreasury}
                      onFinalize={expireTreasuryProposal}
                      finalizing={finalizingTreasury || stats.isPaused}
                    />
                  )}
                />
              )}
              {!loadingTreasury && hasMoreTreasury && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => loadMoreTreasury()}
                    disabled={loadingMoreTreasury}
                  >
                    {loadingMoreTreasury ? 'Loading…' : 'Load more'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
