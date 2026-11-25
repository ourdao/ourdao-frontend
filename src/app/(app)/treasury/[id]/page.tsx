'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  X,
  FileText,
  CheckCircle,
  Eye,
  EyeOff,
  Download,
  Lock,
  Upload,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { AddressLink } from '@/components/AddressLink'
import { ProposalTimeline } from '@/components/ProposalTimeline'
import {
  useUserData,
  useTreasuryProposal,
  useTreasuryVoting,
  useExecuteTreasuryProposal,
  useCommitVote,
  useRevealVote,
  useProposalDocument,
  useToken,
  useDAOStats,
} from '@/hooks/useDAO'
import { generateCommitment, storeCommitSalt, loadCommitSalt, parseSaltBackup } from '@/lib/utils'
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_AWAITING_FUNDS, IPFS_GATEWAY } from '@/constants'
import toast from 'react-hot-toast'

/** File picker for a salt backup. Shared by both places a salt can be imported. */
function SaltImportButton({
  onFile,
  className,
}: {
  onFile: (file: File) => void
  className?: string
}) {
  return (
    <label
      className={cn(
        'relative block cursor-pointer rounded focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
        className
      )}
    >
      <input
        type="file"
        accept=".json"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
        }}
      />
      <span className="flex items-center gap-2 rounded bg-amber-200 px-3 py-2 text-amber-900 hover:bg-amber-300 dark:bg-amber-900 dark:text-amber-100 dark:hover:bg-amber-800">
        <Upload className="h-4 w-4" aria-hidden="true" />
        <span className="text-sm font-medium">Import Salt Backup</span>
      </span>
    </label>
  )
}

export default function TreasuryProposalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const proposalId = parseInt(params.id as string, 10)

  const { isMember, address } = useUserData()
  const token = useToken()
  const { proposal, isLoading, isError, hasVoted, refetch } = useTreasuryProposal(proposalId)
  const { voteOnTreasury, isPending: isVoting } = useTreasuryVoting()
  const { executeTreasuryProposal, isPending: isExecuting } = useExecuteTreasuryProposal()
  const { commitVote, isPending: isCommitting } = useCommitVote()
  const { revealVote, isPending: isRevealing } = useRevealVote()
  const { isPaused, treasuryBalance, refetch: refetchStats } = useDAOStats()
  const { cid: documentCid } = useProposalDocument('Treasury', proposalId)

  const [showCommitDialog, setShowCommitDialog] = useState(false)
  const [commitSupport, setCommitSupport] = useState<boolean | null>(null)
  const [showRevealDialog, setShowRevealDialog] = useState(false)
  const [revealSupport, setRevealSupport] = useState<boolean | null>(null)
  const [importedSalt, setImportedSalt] = useState<Uint8Array | null>(null)
  // The commitment and salt for the vote being committed. Held only until the
  // commit is sent or the dialog is cancelled (#519).
  const [pendingCommit, setPendingCommit] = useState<{
    commitment: Uint8Array
    salt: Uint8Array
  } | null>(null)
  // The commit transaction is not sent until the salt backup has been downloaded (#519).
  const [saltBackedUp, setSaltBackedUp] = useState(false)

  // Check if salt exists in localStorage for this proposal
  const storedSalt = address ? loadCommitSalt(proposalId) : null

  const handleCommit = async (support: boolean) => {
    try {
      const generated = await generateCommitment(support)
      setCommitSupport(support)
      setPendingCommit(generated)
      setSaltBackedUp(false)
      setShowCommitDialog(true)
    } catch {
      toast.error('Could not prepare your vote. Please try again.')
    }
  }

  const cancelCommit = () => {
    setShowCommitDialog(false)
    setCommitSupport(null)
    setPendingCommit(null)
    setSaltBackedUp(false)
  }

  const exportSalt = (salt: Uint8Array) => {
    const saltHex = Array.from(salt)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const saltData = {
      proposalId,
      address,
      salt: saltHex,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(saltData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `treasury-vote-salt-${proposalId}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Salt backup downloaded')
  }

  const importSalt = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const saltArray = parseSaltBackup(e.target?.result as string, {
          proposalId,
          address,
        })
        setImportedSalt(saltArray)
        toast.success('Salt imported successfully')
      } catch (err) {
        if (err instanceof Error) {
          toast.error(err.message)
        } else {
          toast.error('Invalid salt file format')
        }
      }
    }
    reader.readAsText(file)
  }

  const confirmCommit = async () => {
    // Enforced here as well as by the disabled button: no commit without a backup (#519).
    if (!pendingCommit || !saltBackedUp) return
    try {
      // The salt that is backed up must be the one that produced the on-chain
      // commitment, or the vote can never be revealed (#514). Both come from the
      // same `pendingCommit`.
      await commitVote(proposalId, pendingCommit.commitment)
      storeCommitSalt(proposalId, pendingCommit.salt)
      toast.success("Vote committed! Keep your salt backup — you'll need it to reveal your vote.", {
        duration: 6000,
      })
      setShowCommitDialog(false)
      setCommitSupport(null)
      setPendingCommit(null)
      setSaltBackedUp(false)
      refetch()
    } catch {
      // Error handling is in the hook
    }
  }

  const handleReveal = (support: boolean) => {
    setRevealSupport(support)
    setShowRevealDialog(true)
  }

  const confirmReveal = async () => {
    if (revealSupport === null) return
    const salt = importedSalt || storedSalt
    if (!salt) {
      toast.error('No salt found. Import your backup file first.')
      return
    }
    try {
      await revealVote(proposalId, revealSupport, salt)
      toast.success('Vote revealed successfully')
      setShowRevealDialog(false)
      setImportedSalt(null)
      refetch()
    } catch {
      // Error handling is in the hook
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-48 rounded" />
        <div className="skeleton h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !proposal) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link href="/treasury">
            <ArrowLeft className="h-4 w-4" />
            Back to Treasury
          </Link>
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <AlertCircle className="text-destructive mb-3 h-12 w-12" />
            <h3 className="text-foreground text-lg font-semibold">Treasury Proposal Not Found</h3>
            <p className="text-muted-foreground mt-1 mb-4 text-sm">
              The treasury proposal #{proposalId} could not be found or failed to load.
            </p>
            <Button onClick={() => router.push('/treasury')}>Return to Treasury</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // True when the treasury cannot cover the requested amount — the execute call
  // would fail on-chain with InsufficientTreasury in that case.
  const isTreasuryShort = !!proposal && treasuryBalance < proposal.amount

  // Permissionless completion of a withdrawal approved while the treasury was
  // short. Failures are surfaced by the write hook's toast.
  const handleExecute = async () => {
    try {
      await executeTreasuryProposal(proposalId)
      refetch()
      refetchStats()
    } catch {
      /* reported by useWriteAction */
    }
  }

  const statusLabel =
    PROPOSAL_STATUS_LABELS[proposal.status as keyof typeof PROPOSAL_STATUS_LABELS] || 'Unknown'
  const canVotePublic = isMember && proposal.status === 2 && !proposal.isPrivate && !hasVoted
  const canCommit = isMember && proposal.status === 2 && proposal.isPrivate && !hasVoted
  // A salt imported from a backup counts too: without this, a member whose
  // local salt is missing could never reach the reveal buttons (#518).
  const canReveal =
    isMember && proposal.isPrivate && hasVoted && (storedSalt !== null || importedSalt !== null)
  const totalVotes = Number(proposal.votesFor) + Number(proposal.votesAgainst)
  const percentFor = totalVotes > 0 ? Math.round((Number(proposal.votesFor) / totalVotes) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link href="/treasury">
            <ArrowLeft className="h-4 w-4" />
            Back to Treasury
          </Link>
        </Button>
      </div>

      <PageHeader
        title={proposal.title || `Treasury Proposal #${proposal.id}`}
        subtitle={`Proposal #${proposal.id} · Disbursement of DAO treasury funds`}
      />

      {/* Approved by vote but the treasury can't cover it yet (#540) */}
      {proposal.status === PROPOSAL_STATUS_AWAITING_FUNDS && (
        <Card role="status" className="border-amber-300 dark:border-amber-900">
          <CardHeader>
            <CardTitle>Approved — awaiting treasury funds</CardTitle>
            <CardDescription>
              Members approved this withdrawal, but the treasury cannot cover it yet. Once the
              treasury is topped up, any member can execute it.
            </CardDescription>
          </CardHeader>
          {isMember && (
            <CardContent className="space-y-2">
              <Button
                onClick={handleExecute}
                disabled={isExecuting || isPaused || isTreasuryShort}
              >
                {isExecuting ? 'Executing…' : 'Execute'}
              </Button>
              {isTreasuryShort && (
                <p className="text-xs text-muted-foreground">
                  Treasury balance is below the requested amount — execution will succeed once the
                  treasury is topped up.
                </p>
              )}
              {isPaused && !isTreasuryShort && (
                <p className="text-xs text-muted-foreground">Execution is unavailable while the DAO is paused.</p>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Commit Dialog */}
      {showCommitDialog && commitSupport !== null && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Commit Your Vote
            </CardTitle>
            <CardDescription>
              You&apos;re voting <strong>{commitSupport ? 'FOR' : 'AGAINST'}</strong> this proposal
              using private commit-reveal voting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-amber-300 bg-amber-100 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="mb-2 font-semibold">⚠️ Critical: Back up your salt</p>
              <p>
                After committing, you <strong>must download and save your salt backup</strong>.
                Without it, you cannot reveal your vote and it will be forfeited permanently.
              </p>
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  if (pendingCommit) {
                    exportSalt(pendingCommit.salt)
                    setSaltBackedUp(true)
                  }
                }}
                disabled={isCommitting || !pendingCommit}
              >
                <Download className="h-4 w-4" />
                {saltBackedUp ? 'Salt backup downloaded' : 'Step 1: Download salt backup'}
              </Button>
              <p className="text-muted-foreground text-xs">
                {saltBackedUp
                  ? 'Backup saved. You can now commit your vote.'
                  : 'Download the backup before committing. The commit is only sent after this step.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancelCommit} disabled={isCommitting}>
                Cancel
              </Button>
              <Button
                onClick={confirmCommit}
                disabled={isCommitting || isPaused || !saltBackedUp}
                className="flex-1"
              >
                {isCommitting ? 'Committing...' : 'Step 2: Commit Vote'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reveal Dialog */}
      {showRevealDialog && revealSupport !== null && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Reveal Your Vote
            </CardTitle>
            <CardDescription>
              Reveal your committed vote: <strong>{revealSupport ? 'FOR' : 'AGAINST'}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!storedSalt && !importedSalt && (
              <div className="rounded-lg border border-amber-300 bg-amber-100 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="mb-2 font-semibold">Salt not found</p>
                <p className="mb-3">
                  Your salt wasn&apos;t found in local storage. Import your backup file to reveal.
                </p>
                <SaltImportButton onFile={importSalt} />
              </div>
            )}
            {(storedSalt || importedSalt) && (
              <div className="rounded-lg border border-green-300 bg-green-100 p-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200">
                <CheckCircle className="mr-2 inline h-4 w-4" />
                Salt {importedSalt ? 'imported' : 'found in local storage'}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRevealDialog(false)
                  setRevealSupport(null)
                  setImportedSalt(null)
                }}
                disabled={isRevealing}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmReveal}
                disabled={isRevealing || isPaused || (!storedSalt && !importedSalt)}
                className="flex-1"
              >
                {isRevealing ? 'Revealing...' : 'Reveal Vote'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Details */}
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-xl">Proposal Details</CardTitle>
                  <CardDescription>Requested allocation and recipient</CardDescription>
                </div>
                <Badge
                  variant={
                    proposal.status === 5
                      ? 'default'
                      : proposal.status === 4
                        ? 'destructive'
                        : proposal.status === PROPOSAL_STATUS_AWAITING_FUNDS
                          ? 'outline'
                          : 'secondary'
                  }
                  className="px-3 py-1 text-sm"
                >
                  {statusLabel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {proposal.isPrivate && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                  <Lock className="h-5 w-5 shrink-0" />
                  <span>
                    This is a private treasury proposal. Voting uses commit-reveal encryption and
                    public votes are hidden until the reveal phase.
                  </span>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-muted/40 rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs font-medium">Requested Amount</p>
                  <p className="text-foreground mt-1 text-2xl font-bold">
                    {token.format(proposal.amount)}
                  </p>
                </div>

                <div className="bg-muted/40 rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs font-medium">Recipient Address</p>
                  <p
                    className="text-foreground mt-1 font-mono text-sm break-all"
                    title={proposal.recipient}
                  >
                    {proposal.recipient}
                  </p>
                  <div className="text-muted-foreground mt-1 text-xs">
                    <AddressLink address={proposal.recipient} />
                  </div>
                </div>
              </div>

              {proposal.description && (
                <div>
                  <h4 className="text-foreground mb-2 text-sm font-semibold">
                    Description / Reason
                  </h4>
                  <div className="bg-card text-muted-foreground rounded-lg border p-4 text-sm whitespace-pre-wrap">
                    {proposal.description}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attached Document */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Supporting Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documentCid ? (
                <div className="border-border flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="text-primary-600 h-8 w-8 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-foreground font-medium">Attached document</p>
                      <p className="text-muted-foreground truncate font-mono text-xs">
                        {documentCid}
                      </p>
                    </div>
                  </div>
                  {IPFS_GATEWAY && (
                    <a
                      href={`${IPFS_GATEWAY}${documentCid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No document attached to this proposal.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Voting & Sidebar */}
        <div className="space-y-6">
          <ProposalTimeline
            kind="treasury"
            id={proposalId}
            fallbackDates={{
              created: proposal.creationTime,
            }}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Voting Results</CardTitle>
              <CardDescription>Current community consensus</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-4 w-4" /> For
                  </span>
                  <span>
                    {proposal.votesFor} ({percentFor}%)
                  </span>
                </div>
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="h-2 rounded-full bg-emerald-600 transition-all duration-300"
                    style={{ width: `${percentFor}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                    <X className="h-4 w-4" /> Against
                  </span>
                  <span>
                    {proposal.votesAgainst} ({100 - percentFor}%)
                  </span>
                </div>
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="h-2 rounded-full bg-rose-600 transition-all duration-300"
                    style={{ width: `${100 - percentFor}%` }}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                {hasVoted && !proposal.isPrivate ? (
                  <div className="text-muted-foreground bg-muted/50 flex items-center gap-2 rounded-lg p-3 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span>You have already cast your vote on this proposal.</span>
                  </div>
                ) : hasVoted && proposal.isPrivate && canReveal ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                      <Lock className="h-4 w-4" />
                      <span>Vote committed. Reveal when the reveal phase opens.</span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground mb-2 text-xs">
                        Reveal your vote (must match your commitment):
                      </p>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 gap-2"
                          size="sm"
                          disabled={isRevealing || isPaused}
                          onClick={() => handleReveal(true)}
                        >
                          <Eye className="h-4 w-4" />
                          Reveal FOR
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2"
                          disabled={isRevealing || isPaused}
                          onClick={() => handleReveal(false)}
                        >
                          <EyeOff className="h-4 w-4" />
                          Reveal AGAINST
                        </Button>
                      </div>
                      {storedSalt && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full gap-2 text-xs"
                          onClick={() => exportSalt(storedSalt)}
                        >
                          <Download className="h-3 w-3" />
                          Re-download Salt Backup
                        </Button>
                      )}
                    </div>
                  </div>
                ) : hasVoted && proposal.isPrivate ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                      <AlertCircle className="h-4 w-4" />
                      <span>Vote committed, but salt not found. Import backup to reveal.</span>
                    </div>
                    <SaltImportButton onFile={importSalt} className="w-full" />
                  </div>
                ) : canVotePublic ? (
                  <div className="space-y-2">
                    <p className="text-muted-foreground mb-2 text-xs">
                      Cast your vote as a DAO member:
                    </p>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 gap-2"
                        disabled={isVoting || isPaused}
                        onClick={async () => {
                          await voteOnTreasury(proposal.id, true)
                          refetch()
                        }}
                      >
                        <Check className="h-4 w-4" />
                        Vote For
                      </Button>
                      <Button
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10 flex-1 gap-2"
                        disabled={isVoting || isPaused}
                        onClick={async () => {
                          await voteOnTreasury(proposal.id, false)
                          refetch()
                        }}
                      >
                        <X className="h-4 w-4" />
                        Vote Against
                      </Button>
                    </div>
                  </div>
                ) : canCommit ? (
                  <div className="space-y-2">
                    <p className="text-muted-foreground mb-2 text-xs">
                      Commit your vote privately (commit-reveal voting):
                    </p>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 gap-2"
                        disabled={isCommitting || isPaused}
                        onClick={() => handleCommit(true)}
                      >
                        <Lock className="h-4 w-4" />
                        Commit FOR
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-2"
                        disabled={isCommitting || isPaused}
                        onClick={() => handleCommit(false)}
                      >
                        <Lock className="h-4 w-4" />
                        Commit AGAINST
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ You&apos;ll need to download and save your salt backup to reveal later
                    </p>
                  </div>
                ) : proposal.status !== 2 ? (
                  <p className="text-muted-foreground text-xs">
                    Voting is closed for this proposal.
                  </p>
                ) : !isMember ? (
                  <p className="text-muted-foreground text-xs">Only active DAO members may vote.</p>
                ) : (
                  <p className="text-muted-foreground text-xs">Voting is unavailable.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
