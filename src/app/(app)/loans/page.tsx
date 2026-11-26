'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Banknote,
  Plus,
  Filter,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
} from 'lucide-react'
import {
  useUserData,
  useVoting,
  useLoanProposals,
  useHasVoted,
  useDAOStats,
  useExpireProposal,
  type UILoanProposal,
} from '@/hooks/useDAO'
import { LoadError } from '@/components/LoadError'
import { useAnnounceLoad } from '@/lib/useAnnounceLoad'
import { useNow } from '@/hooks/useNow'
import { formatToken, formatDate, calculatePercentage } from '@/lib/utils'
import { AddressLink } from '@/components/AddressLink'
import { PROPOSAL_STATUS_LABELS } from '@/constants'
import { filterLoanProposals, type LoanStatusFilter } from '@/lib/loan-filters'
import { PageHeader } from '@/components/PageHeader'
import type { UserData } from '@/types/dao'
import { VirtualizedList } from '@/components/ui/virtualized-list'

function getStatusIcon(status: number) {
  switch (status) {
    case 1: // IN_EDITING
      return <Clock className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
    case 2: // IN_VOTING
      return <Clock className="h-5 w-5 text-blue-500 dark:text-blue-400" />
    case 3: // APPROVED
      return <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
    case 4: // REJECTED
      return <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
    default:
      return <Clock className="text-muted-foreground h-5 w-5" />
  }
}

function getStatusColor(status: number) {
  switch (status) {
    case 1:
      return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950/30 dark:border-yellow-900'
    case 2:
      return 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-900'
    case 3:
      return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/30 dark:border-green-900'
    case 4:
      return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-900'
    case 7:
      return 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/30 dark:border-amber-900'
    default:
      return 'text-muted-foreground bg-muted border-border'
  }
}

function LoanProposalCard({
  proposal,
  now,
  userData,
  isPending,
  isPaused,
  isExpiring,
  onVote,
  onExpire,
}: {
  proposal: UILoanProposal
  now: number | null
  userData: UserData
  isPending: boolean
  isPaused: boolean
  isExpiring: boolean
  onVote: (proposalId: number, support: boolean) => Promise<unknown>
  onExpire: (proposalId: number) => Promise<unknown>
}) {
  // Only worth a contract read while the proposal can still be voted on.
  const { hasVoted, refetch: refetchHasVoted } = useHasVoted(
    'Loan',
    proposal.id,
    proposal.status === 2
  )

  const canVote =
    now !== null &&
    userData.isMember &&
    proposal.status === 2 &&
    !hasVoted &&
    proposal.borrower !== userData.address &&
    proposal.votingEndTime > Math.floor(now / 1000)

  const alreadyVoted =
    userData.isMember && proposal.status === 2 && hasVoted && proposal.borrower !== userData.address

  const canFinalize =
    now !== null &&
    proposal.status >= 0 &&
    proposal.status <= 2 &&
    proposal.votingEndTime > 0 &&
    Math.floor(now / 1000) > proposal.votingEndTime

  const handleVoteClick = async (support: boolean) => {
    await onVote(proposal.id, support)
    refetchHasVoted()
  }

  return (
    <Card className="transition-shadow hover:shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="mt-1">{getStatusIcon(proposal.status)}</div>
            <div>
              <div className="mb-2 flex items-center space-x-2">
                <CardTitle className="text-lg">Loan Proposal #{proposal.id}</CardTitle>
                {proposal.documentHash && (
                  <span title="Has Documents">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </span>
                )}
              </div>
              <CardDescription>
                By <AddressLink address={proposal.borrower} /> • Created{' '}
                {formatDate(proposal.creationTime)}
              </CardDescription>
            </div>
          </div>
          <div
            className={`rounded-full border px-3 py-1 text-sm font-medium ${getStatusColor(proposal.status)}`}
          >
            {PROPOSAL_STATUS_LABELS[proposal.status as keyof typeof PROPOSAL_STATUS_LABELS] ||
              'Unknown'}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-sm">Amount Requested</p>
            <p className="font-semibold">{formatToken(proposal.amount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Interest Rate</p>
            <p className="font-semibold">{(proposal.interestRate / 100).toFixed(2)}% APR</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Votes For</p>
            <p className="font-semibold text-green-600 dark:text-green-400">{proposal.votesFor}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Votes Against</p>
            <p className="font-semibold text-red-600 dark:text-red-400">{proposal.votesAgainst}</p>
          </div>
        </div>

        {proposal.documentHash && (
          <div className="text-muted-foreground flex items-center text-sm">
            <FileText className="mr-2 h-4 w-4" />
            Supporting document attached
          </div>
        )}

        {/* Voting Progress */}
        {proposal.status === 2 && (
          <div>
            <div className="text-muted-foreground mb-2 flex justify-between text-sm">
              <span>Voting Progress</span>
              <span>
                {proposal.votesFor + proposal.votesAgainst} votes •{' '}
                {now === null
                  ? '…'
                  : `${Math.ceil((proposal.votingEndTime - Math.floor(now / 1000)) / 86400)} days left`}
              </span>
            </div>
            <div className="bg-muted h-2 w-full rounded-full">
              <div
                className="h-2 rounded-full bg-green-500 transition-all"
                style={{
                  width: `${calculatePercentage(
                    proposal.votesFor,
                    proposal.votesFor + proposal.votesAgainst
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex space-x-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/loans/${proposal.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </Button>
            {proposal.documentHash && (
              <Button variant="outline" size="sm" disabled>
                <FileText className="mr-2 h-4 w-4" />
                Documents
              </Button>
            )}
          </div>

          {canVote && (
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleVoteClick(false)}
                disabled={isPending}
                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                Vote Against
              </Button>
              <Button
                size="sm"
                onClick={() => handleVoteClick(true)}
                disabled={isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                Vote For
              </Button>
            </div>
          )}

          {alreadyVoted && (
            <div className="text-muted-foreground flex items-center text-sm">
              <CheckCircle className="mr-1 h-4 w-4 text-green-500 dark:text-green-400" />
              You have voted
            </div>
          )}

          {canFinalize && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onExpire(proposal.id)}
              disabled={isPaused || isExpiring}
              title={isPaused ? 'The DAO is paused' : undefined}
            >
              {isExpiring ? 'Finalizing…' : 'Finalize'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function LoansPage() {
  const userData = useUserData()
  const { voteOnProposal, isPending } = useVoting()
  const { proposals, isLoading, hasMore, loadMore, isLoadingMore, hasErrors, isError, refetch } =
    useLoanProposals()
  useAnnounceLoad('Loan proposals', isLoading, isError)
  const now = useNow()

  const [filters, setFilters] = useState<{ status: LoanStatusFilter; search: string }>({
    status: 'all',
    search: '',
  })

  const filteredProposals = useMemo(
    () => filterLoanProposals(proposals, filters),
    [filters, proposals]
  )

  const handleVote = async (proposalId: number, support: boolean) => {
    await voteOnProposal(proposalId, support)
  }

  const handleExpire = async (proposalId: number) => {
    await expireLoanProposal(proposalId)
  }

  return (
    <>
      <PageHeader
        title="Loan Proposals"
        subtitle="Browse and vote on member loan requests"
        actions={
          userData.isMember && !userData.hasActiveLoan ? (
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/loans/request">
                <Plus className="mr-2 h-5 w-5" />
                Request Loan
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div>
        {/* Filters */}
        <Card className="border-border mb-12 border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-lg font-semibold">
              <Filter className="text-muted-foreground mr-2 h-5 w-5" />
              Filter & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="filter-status" className="text-foreground text-sm font-medium">
                  Status
                </label>
                <select
                  id="filter-status"
                  className="border-input w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, status: e.target.value as LoanStatusFilter }))
                  }
                >
                  <option value="all">All Statuses</option>
                  <option value="editing">In Editing</option>
                  <option value="voting">In Voting</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="filter-search" className="text-foreground text-sm font-medium">
                  Search
                </label>
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                  <input
                    id="filter-search"
                    type="text"
                    placeholder="Search by borrower address or proposal id..."
                    className="border-input w-full rounded-lg border py-2.5 pr-4 pl-10 text-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="mb-12">
          <div className="mb-6">
            <h2 className="text-foreground text-xl font-semibold">Overview</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Current lending activity and proposal statistics
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border border transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50">
                    <Banknote className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Total Proposals</p>
                    <p className="text-foreground text-2xl font-bold">{proposals.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border border transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-50 dark:bg-yellow-950/50">
                    <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">In Voting</p>
                    <p className="text-foreground text-2xl font-bold">
                      {proposals.filter((p) => p.status === 2).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border border transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 dark:bg-green-950/50">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Approved</p>
                    <p className="text-foreground text-2xl font-bold">
                      {proposals.filter((p) => p.status === 3).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border border transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/50">
                    <XCircle className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Rejected</p>
                    <p className="text-foreground text-2xl font-bold">
                      {proposals.filter((p) => p.status === 4).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Proposals List */}
        <div className="space-y-6">
          {hasErrors && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300">
              Some proposals couldn&apos;t be loaded and are missing from this list. Try again
              shortly.
            </div>
          )}
          {isLoading ? (
            <div className="space-y-6">
              {[0, 1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="skeleton mb-4 h-6 w-48 rounded" />
                    <div className="skeleton mb-2 h-4 w-full rounded" />
                    <div className="skeleton h-4 w-2/3 rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : isError && proposals.length === 0 ? (
            <LoadError what="loan proposals" onRetry={refetch} />
          ) : filteredProposals.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Banknote className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h3 className="text-foreground mb-2 text-lg font-medium">No proposals found</h3>
                <p className="text-muted-foreground">
                  {filters.status !== 'all' || filters.search
                    ? 'Try adjusting your filters to see more proposals.'
                    : 'Be the first to request a loan!'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <VirtualizedList
              items={filteredProposals}
              keyExtractor={(proposal) => proposal.id}
              threshold={50}
              itemHeight={220}
              className="space-y-6"
              listAriaLabel="Loan proposals list"
              renderItem={(proposal) => (
                <LoanProposalCard
                  proposal={proposal}
                  now={now}
                  userData={userData}
                  isPending={isPending}
                  isPaused={isPaused}
                  isExpiring={isExpiring}
                  onVote={handleVote}
                  onExpire={handleExpire}
                />
              )}
            />
          )}
          {!isLoading && hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => loadMore()} disabled={isLoadingMore}>
                {isLoadingMore ? 'Loading…' : 'Load more proposals'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
