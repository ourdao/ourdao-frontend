'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Check,
  X,
  FileText,
  CheckCircle,
  Eye,
  EyeOff,
  Download,
  Upload,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { AddressLink } from '@/components/AddressLink'
import { ProposalTimeline } from '@/components/ProposalTimeline'
import {
  useUserData,
  useTreasuryProposal,
  useTreasuryVoting,
  useCommitVote,
  useRevealVote,
  useProposalDocument,
  useToken,
  useDAOStats,
} from '@/hooks/useDAO'
import { formatToken, generateCommitment, storeCommitSalt, loadCommitSalt } from '@/lib/utils'
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_AWAITING_FUNDS } from '@/constants'
import toast from 'react-hot-toast'

export default function TreasuryProposalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const proposalId = parseInt(params.id as string, 10)

  const { isMember, address } = useUserData()
  const token = useToken()
  const { proposal, isLoading, isError, hasVoted, refetch } = useTreasuryProposal(proposalId)
  const { voteOnTreasury, isPending: isVoting } = useTreasuryVoting()
  const { commitVote, isPending: isCommitting } = useCommitVote()
  const { revealVote, isPending: isRevealing } = useRevealVote()
  const { isPaused } = useDAOStats()
  const { cid: documentCid } = useProposalDocument('Treasury', proposalId)

  const [showCommitDialog, setShowCommitDialog] = useState(false)
  const [commitSupport, setCommitSupport] = useState<boolean | null>(null)
  const [saltBackedUp, setSaltBackedUp] = useState(false)
  const [showRevealDialog, setShowRevealDialog] = useState(false)
  const [revealSupport, setRevealSupport] = useState<boolean | null>(null)
  const [importedSalt, setImportedSalt] = useState<Uint8Array | null>(null)

  // Check if salt exists in localStorage for this proposal
  const storedSalt = address ? loadCommitSalt(proposalId) : null

  useEffect(() => {
    if (showCommitDialog) {
      setSaltBackedUp(false)
    }
  }, [showCommitDialog])

  const handleCommit = async (support: boolean) => {
    setCommitSupport(support)
    setShowCommitDialog(true)
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
    setSaltBackedUp(true)
    toast.success('Salt backup downloaded')
  }

  const importSalt = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (data.proposalId !== proposalId) {
          toast.error('Salt file is for a different proposal')
          return
        }
        if (data.address !== address) {
          toast.error('Salt file is for a different address')
          return
        }
        const saltArray = new Uint8Array(
          (data.salt.match(/.{1,2}/g) || []).map((byte: string) => parseInt(byte, 16))
        )
        setImportedSalt(saltArray)
        toast.success('Salt imported successfully')
      } catch {
        toast.error('Invalid salt file format')
      }
    }
    reader.readAsText(file)
  }

  const confirmCommit = async () => {
    if (commitSupport === null) return
    try {
      const { commitment, salt } = await generateCommitment(commitSupport)
      await commitVote(proposalId, commitment)
      storeCommitSalt(proposalId, salt)
      toast.success(
        'Vote committed! Save your salt backup — you'll need it to reveal your vote.',
        { duration: 6000 }
      )
      setShowCommitDialog(false)
      refetch()
    } catch (err) {
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
    } catch (err) {
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
            <AlertCircle className="h-12 w-12 text-destructive mb-3" />
            <h3 className="text-lg font-semibold text-foreground">Treasury Proposal Not Found</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              The treasury proposal #{proposalId} could not be found or failed to load.
            </p>
            <Button onClick={() => router.push('/treasury')}>Return to Treasury</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusLabel =
    PROPOSAL_STATUS_LABELS[proposal.status as keyof typeof PROPOSAL_STATUS_LABELS] || 'Unknown'
  const canVotePublic = isMember && proposal.status === 2 && !proposal.isPrivate && !hasVoted
  const canCommit = isMember && proposal.status === 2 && proposal.isPrivate && !hasVoted
  const canReveal = isMember && proposal.isPrivate && hasVoted && storedSalt !== null
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

      {/* Commit Dialog */}
      {showCommitDialog && commitSupport !== null && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Commit Your Vote
            </CardTitle>
            <CardDescription>
              You're voting <strong>{commitSupport ? 'FOR' : 'AGAINST'}</strong> this proposal using private
              commit-reveal voting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-amber-300 bg-amber-100 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-semibold mb-2">⚠️ Critical: Back up your salt</p>
              <p>
                After committing, you <strong>must download and save your salt backup</strong>. Without it,
                you cannot reveal your vote and it will be forfeited permanently.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCommitDialog(false)
                  setCommitSupport(null)
                  setSaltBackedUp(false)
                }}
                disabled={isCommitting}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  const { commitment, salt } = await generateCommitment(commitSupport)
                  exportSalt(salt)
                  await confirmCommit()
                }}
                disabled={isCommitting || isPaused}
                className="flex-1"
              >
                {isCommitting ? 'Committing...' : 'Commit Vote & Download Salt'}
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
                <p className="font-semibold mb-2">Salt not found</p>
                <p className="mb-3">
                  Your salt wasn't found in local storage. Import your backup file to reveal.
                </p>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) importSalt(file)
                    }}
                  />
                  <div className="flex items-center gap-2 rounded bg-amber-200 px-3 py-2 text-amber-900 hover:bg-amber-300 dark:bg-amber-900 dark:text-amber-100 dark:hover:bg-amber-800">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm font-medium">Import Salt Backup</span>
                  </div>
                </label>
              </div>
            )}
            {(storedSalt || importedSalt) && (
              <div className="rounded-lg border border-green-300 bg-green-100 p-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200">
                <CheckCircle className="h-4 w-4 inline mr-2" />
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
        <div className="md:col-span-2 space-y-6">
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
                  className="text-sm px-3 py-1"
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
                <div className="rounded-lg border p-4 bg-muted/40">
                  <p className="text-xs font-medium text-muted-foreground">Requested Amount</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {token.format(proposal.amount)}
                  </p>
                </div>

                <div className="rounded-lg border p-4 bg-muted/40">
                  <p className="text-xs font-medium text-muted-foreground">Recipient Address</p>
                  <p className="text-sm font-mono text-foreground mt-1 break-all" title={proposal.recipient}>
                    {proposal.recipient}
                  </p>
                  <div className="text-xs text-muted-foreground mt-1">
                    <AddressLink address={proposal.recipient} />
                  </div>
                </div>
              </div>

              {proposal.description && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Description / Reason</h4>
                  <div className="rounded-lg border p-4 bg-card text-sm text-muted-foreground whitespace-pre-wrap">
                    {proposal.description}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attached Document */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Supporting Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documentCid ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="h-8 w-8 shrink-0 text-primary-600" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">Attached document</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {documentCid}
                      </p>
                    </div>
                  </div>
                  {process.env.NEXT_PUBLIC_IPFS_GATEWAY && (
                    <a
                      href={`${process.env.NEXT_PUBLIC_IPFS_GATEWAY}${documentCid}`}
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
                <p className="text-sm text-muted-foreground">No document attached to this proposal.</p>
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
                  <span>{proposal.votesFor} ({percentFor}%)</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${percentFor}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                    <X className="h-4 w-4" /> Against
                  </span>
                  <span>{proposal.votesAgainst} ({100 - percentFor}%)</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-rose-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${100 - percentFor}%` }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                {hasVoted && !proposal.isPrivate ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span>You have already cast your vote on this proposal.</span>
                  </div>
                ) : hasVoted && proposal.isPrivate && canReveal ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 p-3 rounded-lg dark:bg-blue-950/30 dark:text-blue-300">
                      <Lock className="h-4 w-4" />
                      <span>Vote committed. Reveal when the reveal phase opens.</span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground mb-2">
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
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4" />
                    <span>Vote committed, but salt not found. Import backup to reveal.</span>
                  </div>
                ) : canVotePublic ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-2">Cast your vote as a DAO member:</p>
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
                        className="flex-1 gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
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
                    <p className="text-xs text-muted-foreground mb-2">
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
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                      ⚠️ You'll need to download and save your salt backup to reveal later
                    </p>
                  </div>
                ) : proposal.status !== 2 ? (
                  <p className="text-xs text-muted-foreground">Voting is closed for this proposal.</p>
                ) : !isMember ? (
                  <p className="text-xs text-muted-foreground">Only active DAO members may vote.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Voting is unavailable.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
