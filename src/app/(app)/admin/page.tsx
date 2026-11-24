'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import {
  ShieldCheckIcon,
  UsersIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  PlayIcon,
  TrashIcon,
} from '@/lib/icons'
import {
  useUserData,
  useDAOStats,
  useAdmins,
  useAdminActions,
  useAdminLog,
  useFailedEvents,
  usePauserActions,
  usePolicyUpdateActions,
} from '@/hooks/useDAO'
import { AddressLink } from '@/components/AddressLink'
import { LoadError } from '@/components/LoadError'
import { useAnnounceLoad } from '@/lib/useAnnounceLoad'
import { formatToken, formatDate, formatThreshold } from '@/lib/utils'
import { formatStellarAddress, isStellarAddress } from '@/lib/stellar'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/ui/stat-card'

type Tab = 'overview' | 'governance' | 'policy' | 'activity' | 'quarantined'

const TABS: { id: Tab; name: string; icon: ReactNode }[] = [
  { id: 'overview', name: 'Overview', icon: <ChartBarIcon className="h-4 w-4" /> },
  { id: 'governance', name: 'Governance', icon: <UsersIcon className="h-4 w-4" /> },
  { id: 'policy', name: 'Policy & Pauser', icon: <ShieldCheckIcon className="h-4 w-4" /> },
  { id: 'activity', name: 'Activity Log', icon: <ClockIcon className="h-4 w-4" /> },
  {
    id: 'quarantined',
    name: 'Quarantined Events',
    icon: <ExclamationTriangleIcon className="h-4 w-4" />,
  },
]

export default function AdminPage() {
  const userData = useUserData()
  const stats = useDAOStats()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  if (!userData.isConnected) {
    return (
      <GuardMessage
        icon={
          <ExclamationTriangleIcon className="mx-auto mb-4 h-12 w-12 text-yellow-500 dark:text-yellow-400" />
        }
        title="Wallet Not Connected"
        message="Please connect your wallet to access the admin panel."
      />
    )
  }

  if (userData.isLoading) {
    // Same "not yet known" collapse as isMember (#69) — isAdmin reads false
    // until the query resolves, which would otherwise flash "Access Denied"
    // at real admins on every load. No AppShell wrapper needed — the (app)
    // route-group layout already provides it.
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (userData.isError) {
    // isAdmin reads false when the read fails — "Access Denied" would be a lie.
    return (
      <div className="mx-auto mt-8 max-w-md">
        <LoadError what="your admin status" onRetry={userData.refetch} />
      </div>
    )
  }

  if (!userData.isAdmin) {
    return (
      <GuardMessage
        icon={
          <ExclamationTriangleIcon className="mx-auto mb-4 h-12 w-12 text-red-500 dark:text-red-400" />
        }
        title="Access Denied"
        message="You need admin privileges to access this panel."
      />
    )
  }

  return (
    <>
      <PageHeader title="Admin Dashboard" subtitle="Real-time DAO governance and system state." />
      {stats.quarantinedEvents > 0 ? (
        <div className="mx-auto mb-6 flex max-w-7xl items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">Warning:</span> {stats.quarantinedEvents} quarantined
            event(s) detected. Handlers failed to process these events; some indexer data may be
            delayed or incomplete. Check the <strong>Quarantined Events</strong> tab for details.
          </div>
        </div>
      ) : null}
      <div className="mx-auto max-w-7xl">
        <div className="bg-card border-border rounded-lg border shadow">
          <div className="border-border border-b">
            <nav className="flex space-x-8 px-6">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 border-b-2 py-4 text-sm font-medium ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-muted-foreground hover:text-foreground border-transparent'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>
          <div className="p-6">
            {activeTab === 'overview' && <OverviewTab stats={stats} />}
            {activeTab === 'governance' && <GovernanceTab stats={stats} />}
            {activeTab === 'policy' && <PolicyPauserTab />}
            {activeTab === 'activity' && <ActivityTab />}
            {activeTab === 'quarantined' && <QuarantinedEventsTab />}
          </div>
        </div>
      </div>
    </>
  )
}

function GuardMessage({
  icon,
  title,
  message,
}: {
  icon: ReactNode
  title: string
  message: string
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="bg-card rounded-lg p-6 text-center">
        {icon}
        <h2 className="text-foreground mb-2 text-xl font-semibold">{title}</h2>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

function OverviewTab({ stats }: { stats: ReturnType<typeof useDAOStats> }) {
  const { pause, unpause, isPending } = useAdminActions()

  return (
    <div className="space-y-6">
      <div
        className={`rounded-lg border p-6 ${
          stats.isPaused
            ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
            : 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`rounded-full p-2 ${stats.isPaused ? 'bg-red-100 dark:bg-red-900/40' : 'bg-green-100 dark:bg-green-900/40'}`}
            >
              <ShieldCheckIcon
                className={`h-6 w-6 ${stats.isPaused ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}
              />
            </div>
            <div>
              <h3
                className={`text-lg font-semibold ${stats.isPaused ? 'text-red-900 dark:text-red-300' : 'text-green-900 dark:text-green-300'}`}
              >
                Contract is {stats.isPaused ? 'Paused' : 'Active'}
              </h3>
              <p
                className={`text-sm ${stats.isPaused ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}
              >
                {stats.isPaused
                  ? 'All state-changing operations are currently blocked on-chain.'
                  : 'Members can register, vote, and transact normally.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (stats.isPaused) {
                if (
                  !window.confirm(
                    'Unpause the DAO? This will re-enable all state-changing operations for every member.'
                  )
                )
                  return
                unpause().catch(() => {})
              } else {
                if (
                  !window.confirm(
                    'Pause the DAO? This will halt new loans, votes, and proposals for every member immediately.'
                  )
                )
                  return
                pause().catch(() => {})
              }
            }}
            disabled={isPending}
            className={`flex items-center space-x-2 rounded-md px-4 py-2 text-white disabled:opacity-50 ${
              stats.isPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {stats.isPaused ? (
              <PlayIcon className="h-4 w-4" />
            ) : (
              <ExclamationTriangleIcon className="h-4 w-4" />
            )}
            <span>{stats.isPaused ? 'Unpause' : 'Pause'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Members"
          value={stats.activeMembers.toLocaleString()}
          sub={`${stats.totalMembers} total ever joined`}
        />
        <StatCard
          label="Active Loans"
          value={stats.activeLoans.toLocaleString()}
          sub={`${stats.totalLoans} total`}
        />
        <StatCard label="Treasury Balance" value={formatToken(stats.treasuryBalance)} />
        <StatCard label="Consensus Threshold" value={formatThreshold(stats.consensusThreshold)} />
      </div>
    </div>
  )
}

function GovernanceTab({ stats }: { stats: ReturnType<typeof useDAOStats> }) {
  const { admins, isLoading, isError: adminsError, refetch } = useAdmins()
  const { addAdmin, removeAdmin, setThreshold, isPending, isSuccess } = useAdminActions()
  const [newAdmin, setNewAdmin] = useState('')
  const [threshold, setThresholdInput] = useState('')

  // Same class of input as the governance proposal form's destination
  // address, validated against the same shared predicate before a
  // transaction is ever built — granting admin rights is among the
  // highest-stakes actions in the app and deserves at least what the
  // withdrawal-adjacent form already has (#66).
  const trimmedNewAdmin = newAdmin.trim()
  const newAdminError = trimmedNewAdmin.length > 0 && !isStellarAddress(trimmedNewAdmin)

  const submitAddAdmin = async (e: FormEvent) => {
    e.preventDefault()
    if (!trimmedNewAdmin || !isStellarAddress(trimmedNewAdmin)) return
    if (
      !window.confirm(
        `Add ${formatStellarAddress(trimmedNewAdmin)} as an admin? This grants full admin privileges.`
      )
    )
      return
    // `run` already toasted the failure; it rethrows for callers that need to
    // react, but a form handler has nothing to add, so swallow it here (#316).
    try {
      await addAdmin(trimmedNewAdmin)
    } catch {
      return
    }
    setNewAdmin('')
    refetch()
  }

  const submitThreshold = async (e: FormEvent) => {
    e.preventDefault()
    const bps = Number(threshold)
    if (!Number.isInteger(bps) || bps <= 0 || bps > 10_000) return
    if (
      !window.confirm(
        `Update consensus threshold from ${formatThreshold(stats.consensusThreshold)} to ${formatThreshold(bps)}? This changes the approval bar for every open proposal.`
      )
    )
      return
    try {
      await setThreshold(bps)
    } catch {
      return
    }
    setThresholdInput('')
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border-border rounded-lg border">
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-foreground text-lg font-semibold">Admins ({admins.length})</h3>
        </div>
        <div className="divide-border divide-y">
          {isLoading && <div className="text-muted-foreground px-6 py-4 text-sm">Loading…</div>}
          {adminsError && (
            <LoadError what="the admin list" onRetry={() => void refetch()} className="m-4" />
          )}
          {admins.map((addr) => (
            <div key={addr} className="flex items-center justify-between px-6 py-3">
              <AddressLink address={addr} className="text-foreground text-sm" />
              <button
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Remove admin ${formatStellarAddress(addr)}? This action requires a remaining admin to re-add them.`
                    )
                  )
                    return
                  try {
                    await removeAdmin(addr)
                  } catch {
                    return
                  }
                  refetch()
                }}
                disabled={isPending || admins.length <= 1}
                title={admins.length <= 1 ? 'Cannot remove the last admin' : 'Remove admin'}
                className="flex items-center space-x-1 text-sm text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400 dark:hover:text-red-300"
              >
                <TrashIcon className="h-4 w-4" />
                <span>Remove</span>
              </button>
            </div>
          ))}
        </div>
        <form
          onSubmit={submitAddAdmin}
          className="border-border flex items-start space-x-2 border-t p-6"
        >
          <div className="flex-1">
            <input
              type="text"
              value={newAdmin}
              onChange={(e) => setNewAdmin(e.target.value)}
              placeholder="G… address to add as admin"
              aria-label="Address to add as admin"
              aria-invalid={newAdminError}
              className="border-input dark:bg-muted dark:text-foreground w-full rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              aria-describedby={newAdminError ? 'new-admin-error' : undefined}
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-muted dark:text-foreground"
            />
            {newAdminError && (
              <p id="new-admin-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                Enter a valid Stellar destination address (G… or C…)
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isPending || !trimmedNewAdmin || !isStellarAddress(trimmedNewAdmin)}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Add Admin
          </button>
        </form>
      </div>

      <div className="bg-card border-border rounded-lg border">
        <div className="border-border border-b px-6 py-4">
          <h3 className="text-foreground text-lg font-semibold">Consensus Threshold</h3>
          <p className="text-muted-foreground text-sm">
            Currently {formatThreshold(stats.consensusThreshold)} of active members, in basis
            points.
          </p>
        </div>
        <form onSubmit={submitThreshold} className="flex space-x-2 p-6">
          <input
            type="number"
            min={1}
            max={10_000}
            value={threshold}
            onChange={(e) => setThresholdInput(e.target.value)}
            aria-label="Consensus threshold in basis points"
            placeholder="e.g. 5100 for 51%"
            className="border-input dark:bg-muted dark:text-foreground flex-1 rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isPending || !threshold}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Update Threshold
          </button>
        </form>
        {isSuccess && (
          <p className="px-6 pb-4 text-sm text-green-600 dark:text-green-400">Updated.</p>
        )}
      </div>
    </div>
  )
}

function PolicyPauserTab() {
  const { setPauser, revokePauser, isPending: pauserPending } = usePauserActions()
  const { proposePolicyUpdate, executePolicyUpdate, cancelPolicyUpdate, isPending: policyPending } = usePolicyUpdateActions()
  const [pauserAddr, setPauserAddr] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [interestBps, setInterestBps] = useState('')
  const [maxDuration, setMaxDuration] = useState('')

  const submitSetPauser = async (e: FormEvent) => {
    e.preventDefault()
    const addr = pauserAddr.trim()
    if (!addr) return
    if (!window.confirm(`Grant pause rights to ${addr}?`)) return
    try { await setPauser(addr) } catch { return }
    setPauserAddr('')
  }

  const submitRevokePauser = async () => {
    if (!window.confirm('Revoke the current pauser role?')) return
    try { await revokePauser() } catch { return }
  }

  const submitPropose = async (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(maxAmount)
    const bps = Number(interestBps)
    const dur = Number(maxDuration)
    if (!amount || !bps || !dur) return
    if (!window.confirm(`Propose policy update: max loan ${amount}, interest ${bps} bps, duration ${dur} ledgers?`)) return
    try {
      await proposePolicyUpdate({
        max_loan_amount: BigInt(amount),
        interest_rate_bps: bps,
        max_loan_duration_ledgers: dur,
      } as any)
    } catch { return }
    setMaxAmount(''); setInterestBps(''); setMaxDuration('')
  }

  return (
    <div className="space-y-6">
      {/* Pauser role */}
      <div className="bg-card rounded-lg border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Pauser Role</h3>
          <p className="text-sm text-muted-foreground">Grant or revoke the right to pause the DAO without full admin privileges.</p>
        </div>
        <form onSubmit={submitSetPauser} className="p-6 flex items-start space-x-2">
          <input
            type="text"
            value={pauserAddr}
            onChange={(e) => setPauserAddr(e.target.value)}
            placeholder="G… address to grant pauser role"
            aria-label="Pauser address"
            className="flex-1 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-muted dark:text-foreground"
          />
          <button
            type="submit"
            disabled={pauserPending || !pauserAddr.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Set Pauser
          </button>
        </form>
        <div className="px-6 pb-6">
          <button
            onClick={submitRevokePauser}
            disabled={pauserPending}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            Revoke Pauser
          </button>
        </div>
      </div>

      {/* Policy update flow */}
      <div className="bg-card rounded-lg border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Loan Policy Update</h3>
          <p className="text-sm text-muted-foreground">Propose, execute, or cancel the governed policy-update flow.</p>
        </div>
        <form onSubmit={submitPropose} className="p-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Max Loan Amount</label>
              <input
                type="number"
                min={1}
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="stroops"
                aria-label="Max loan amount in stroops"
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-muted dark:text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Interest Rate (bps)</label>
              <input
                type="number"
                min={1}
                max={10000}
                value={interestBps}
                onChange={(e) => setInterestBps(e.target.value)}
                placeholder="e.g. 500 = 5%"
                aria-label="Interest rate in basis points"
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-muted dark:text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Max Duration (ledgers)</label>
              <input
                type="number"
                min={1}
                value={maxDuration}
                onChange={(e) => setMaxDuration(e.target.value)}
                placeholder="ledgers"
                aria-label="Max loan duration in ledgers"
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-muted dark:text-foreground"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={policyPending || !maxAmount || !interestBps || !maxDuration}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Propose Update
          </button>
        </form>
        <div className="px-6 pb-6 flex space-x-3">
          <button
            onClick={async () => {
              if (!window.confirm('Execute the pending policy update?')) return
              try { await executePolicyUpdate() } catch { return }
            }}
            disabled={policyPending}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            Execute Update
          </button>
          <button
            onClick={async () => {
              if (!window.confirm('Cancel the pending policy update?')) return
              try { await cancelPolicyUpdate() } catch { return }
            }}
            disabled={policyPending}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            Cancel Update
          </button>
        </div>
      </div>
    </div>
  )
}

function ActivityTab() {
  const { entries, isLoading, isError, refetch } = useAdminLog(100)
  useAnnounceLoad('Admin event history', isLoading, isError)

  return (
    <div className="bg-card border-border rounded-lg border">
      <div className="border-border border-b px-6 py-4">
        <h3 className="text-foreground text-lg font-semibold">Admin/Governance Event History</h3>
        <p className="text-muted-foreground text-sm">
          Indexed on-chain events: admin add/remove, threshold and policy changes, pause/unpause.
        </p>
      </div>
      <div className="divide-border divide-y">
        {isLoading && <div className="text-muted-foreground px-6 py-4 text-sm">Loading…</div>}
        {isError && (
          <LoadError
            what="the admin event history"
            onRetry={() => void refetch()}
            className="m-4"
          />
        )}
        {!isLoading && !isError && entries.length === 0 && (
          <div className="text-muted-foreground px-6 py-8 text-center">
            No admin/governance events indexed yet.
          </div>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center space-x-3">
              <span className="bg-muted text-foreground rounded px-2 py-1 font-mono text-xs">
                {entry.symbol}
              </span>
              <span className="text-foreground text-sm">Ledger {entry.ledger}</span>
            </div>
            <span className="text-muted-foreground text-xs">{formatDate(entry.closedAt)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuarantinedEventsTab() {
  const { failedEvents, isLoading, isError, refetch } = useFailedEvents()

  return (
    <div className="bg-card border-border rounded-lg border">
      <div className="border-border border-b px-6 py-4">
        <h3 className="text-foreground text-lg font-semibold">Quarantined / Failed Events</h3>
        <p className="text-muted-foreground text-sm">
          Events that failed indexer handler processing and are quarantined for investigation.
        </p>
      </div>
      <div className="divide-border divide-y">
        {isLoading && (
          <div className="text-muted-foreground px-6 py-4 text-sm">Loading quarantined events…</div>
        )}
        {isError && (
          <LoadError what="quarantined events" onRetry={() => void refetch()} className="m-4" />
        )}
        {!isLoading && !isError && failedEvents.length === 0 && (
          <div className="text-muted-foreground px-6 py-8 text-center">
            No quarantined events found. All handlers operating cleanly.
          </div>
        )}
        {failedEvents.map((ev) => (
          <div key={ev.id} className="flex flex-col gap-1 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="rounded bg-red-100 px-2 py-1 font-mono text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {ev.symbol}
                </span>
                <span className="text-foreground text-sm font-medium">Ledger #{ev.ledger}</span>
                {ev.retry_count !== undefined && (
                  <span className="text-muted-foreground text-xs">Retries: {ev.retry_count}</span>
                )}
              </div>
              <span className="text-muted-foreground text-xs">{formatDate(ev.created_at)}</span>
            </div>
            <div className="mt-1 rounded bg-red-50 p-2 font-mono text-xs text-red-600 dark:bg-red-950/20 dark:text-red-400">
              {ev.error}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
