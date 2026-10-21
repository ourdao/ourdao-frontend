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
} from '@/hooks/useDAO'
import { AddressLink } from '@/components/AddressLink'
import { LoadError } from '@/components/LoadError'
import { useAnnounceLoad } from '@/lib/useAnnounceLoad'
import { formatToken, formatDate, formatThreshold } from '@/lib/utils'
import { formatStellarAddress, isStellarAddress } from '@/lib/stellar'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/ui/stat-card'

type Tab = 'overview' | 'governance' | 'activity' | 'quarantined'

const TABS: { id: Tab; name: string; icon: ReactNode }[] = [
  { id: 'overview', name: 'Overview', icon: <ChartBarIcon className="h-4 w-4" /> },
  { id: 'governance', name: 'Governance', icon: <UsersIcon className="h-4 w-4" /> },
  { id: 'activity', name: 'Activity Log', icon: <ClockIcon className="h-4 w-4" /> },
  { id: 'quarantined', name: 'Quarantined Events', icon: <ExclamationTriangleIcon className="h-4 w-4" /> },
]

export default function AdminPage() {
  const userData = useUserData()
  const stats = useDAOStats()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  if (!userData.isConnected) {
    return (
      <GuardMessage
        icon={<ExclamationTriangleIcon className="h-12 w-12 text-yellow-500 dark:text-yellow-400 mx-auto mb-4" />}
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
        <LoadError
          what="your admin status"
          onRetry={userData.refetch}
        />
      </div>
    )
  }

  if (!userData.isAdmin) {
    return (
      <GuardMessage
        icon={<ExclamationTriangleIcon className="h-12 w-12 text-red-500 dark:text-red-400 mx-auto mb-4" />}
        title="Access Denied"
        message="You need admin privileges to access this panel."
      />
    )
  }

  return (
    <>
      <PageHeader title="Admin Dashboard" subtitle="Real-time DAO governance and system state." />
      {stats.quarantinedEvents > 0 ? (
        <div className="max-w-7xl mx-auto mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-amber-600 dark:text-amber-400">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">Warning:</span> {stats.quarantinedEvents} quarantined event(s) detected. Handlers failed to process these events; some indexer data may be delayed or incomplete. Check the <strong>Quarantined Events</strong> tab for details.
          </div>
        </div>
      ) : null}
      <div className="max-w-7xl mx-auto">
        <div className="bg-card rounded-lg shadow border border-border">
          <div className="border-b border-border">
            <nav className="flex space-x-8 px-6">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 text-sm font-medium border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
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
            {activeTab === 'activity' && <ActivityTab />}
            {activeTab === 'quarantined' && <QuarantinedEventsTab />}
          </div>
        </div>
      </div>
    </>
  )
}

function GuardMessage({ icon, title, message }: { icon: ReactNode; title: string; message: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="bg-card rounded-lg p-6 text-center">
        {icon}
        <h2 className="text-xl font-semibold text-foreground mb-2">{title}</h2>
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
        className={`rounded-lg p-6 border ${
          stats.isPaused ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900' : 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${stats.isPaused ? 'bg-red-100 dark:bg-red-900/40' : 'bg-green-100 dark:bg-green-900/40'}`}>
              <ShieldCheckIcon className={`h-6 w-6 ${stats.isPaused ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${stats.isPaused ? 'text-red-900 dark:text-red-300' : 'text-green-900 dark:text-green-300'}`}>
                Contract is {stats.isPaused ? 'Paused' : 'Active'}
              </h3>
              <p className={`text-sm ${stats.isPaused ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                {stats.isPaused
                  ? 'All state-changing operations are currently blocked on-chain.'
                  : 'Members can register, vote, and transact normally.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (stats.isPaused) {
                if (!window.confirm('Unpause the DAO? This will re-enable all state-changing operations for every member.')) return
                unpause().catch(() => {})
              } else {
                if (!window.confirm('Pause the DAO? This will halt new loans, votes, and proposals for every member immediately.')) return
                pause().catch(() => {})
              }
            }}
            disabled={isPending}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-white disabled:opacity-50 ${
              stats.isPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {stats.isPaused ? <PlayIcon className="h-4 w-4" /> : <ExclamationTriangleIcon className="h-4 w-4" />}
            <span>{stats.isPaused ? 'Unpause' : 'Pause'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Active Members" value={stats.activeMembers.toLocaleString()} sub={`${stats.totalMembers} total ever joined`} />
        <StatCard label="Active Loans" value={stats.activeLoans.toLocaleString()} sub={`${stats.totalLoans} total`} />
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
    if (!window.confirm(`Add ${formatStellarAddress(trimmedNewAdmin)} as an admin? This grants full admin privileges.`)) return
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
    if (!window.confirm(`Update consensus threshold from ${formatThreshold(stats.consensusThreshold)} to ${formatThreshold(bps)}? This changes the approval bar for every open proposal.`)) return
    try {
      await setThreshold(bps)
    } catch {
      return
    }
    setThresholdInput('')
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border border-border">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Admins ({admins.length})</h3>
        </div>
        <div className="divide-y divide-border">
          {isLoading && <div className="px-6 py-4 text-sm text-muted-foreground">Loading…</div>}
          {adminsError && <LoadError what="the admin list" onRetry={() => void refetch()} className="m-4" />}
          {admins.map((addr) => (
            <div key={addr} className="px-6 py-3 flex items-center justify-between">
              <AddressLink address={addr} className="text-sm text-foreground" />
              <button
                onClick={async () => {
                  if (!window.confirm(`Remove admin ${formatStellarAddress(addr)}? This action requires a remaining admin to re-add them.`)) return
                  try {
                    await removeAdmin(addr)
                  } catch {
                    return
                  }
                  refetch()
                }}
                disabled={isPending || admins.length <= 1}
                title={admins.length <= 1 ? 'Cannot remove the last admin' : 'Remove admin'}
                className="flex items-center space-x-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <TrashIcon className="h-4 w-4" />
                <span>Remove</span>
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={submitAddAdmin} className="p-6 flex items-start space-x-2 border-t border-border">
          <div className="flex-1">
            <input
              type="text"
              value={newAdmin}
              onChange={(e) => setNewAdmin(e.target.value)}
              placeholder="G… address to add as admin"
              aria-invalid={newAdminError}
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-muted dark:text-foreground"
            />
            {newAdminError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                Enter a valid Stellar destination address (G… or C…)
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isPending || !trimmedNewAdmin || !isStellarAddress(trimmedNewAdmin)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Add Admin
          </button>
        </form>
      </div>

      <div className="bg-card rounded-lg border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Consensus Threshold</h3>
          <p className="text-sm text-muted-foreground">
            Currently {formatThreshold(stats.consensusThreshold)} of active members, in basis points.
          </p>
        </div>
        <form onSubmit={submitThreshold} className="p-6 flex space-x-2">
          <input
            type="number"
            min={1}
            max={10_000}
            value={threshold}
            onChange={(e) => setThresholdInput(e.target.value)}
            placeholder="e.g. 5100 for 51%"
            className="flex-1 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-muted dark:text-foreground"
          />
          <button
            type="submit"
            disabled={isPending || !threshold}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Update Threshold
          </button>
        </form>
        {isSuccess && <p className="px-6 pb-4 text-sm text-green-600 dark:text-green-400">Updated.</p>}
      </div>
    </div>
  )
}

function ActivityTab() {
  const { entries, isLoading, isError, refetch } = useAdminLog(100)
  useAnnounceLoad('Admin event history', isLoading, isError)

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">
          Admin/Governance Event History
        </h3>
        <p className="text-sm text-muted-foreground">
          Indexed on-chain events: admin add/remove, threshold and policy changes, pause/unpause.
        </p>
      </div>
      <div className="divide-y divide-border">
        {isLoading && <div className="px-6 py-4 text-sm text-muted-foreground">Loading…</div>}
        {isError && <LoadError what="the admin event history" onRetry={() => void refetch()} className="m-4" />}
        {!isLoading && !isError && entries.length === 0 && (
          <div className="px-6 py-8 text-center text-muted-foreground">
            No admin/governance events indexed yet.
          </div>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="px-2 py-1 text-xs font-mono bg-muted text-foreground rounded">
                {entry.symbol}
              </span>
              <span className="text-sm text-foreground">Ledger {entry.ledger}</span>
            </div>
            <span className="text-xs text-muted-foreground">{formatDate(entry.closedAt)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuarantinedEventsTab() {
  const { failedEvents, isLoading, isError, refetch } = useFailedEvents()

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">
          Quarantined / Failed Events
        </h3>
        <p className="text-sm text-muted-foreground">
          Events that failed indexer handler processing and are quarantined for investigation.
        </p>
      </div>
      <div className="divide-y divide-border">
        {isLoading && <div className="px-6 py-4 text-sm text-muted-foreground">Loading quarantined events…</div>}
        {isError && <LoadError what="quarantined events" onRetry={() => void refetch()} className="m-4" />}
        {!isLoading && !isError && failedEvents.length === 0 && (
          <div className="px-6 py-8 text-center text-muted-foreground">
            No quarantined events found. All handlers operating cleanly.
          </div>
        )}
        {failedEvents.map((ev) => (
          <div key={ev.id} className="px-6 py-4 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="px-2 py-1 text-xs font-mono bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded">
                  {ev.symbol}
                </span>
                <span className="text-sm font-medium text-foreground">Ledger #{ev.ledger}</span>
                {ev.retry_count !== undefined && (
                  <span className="text-xs text-muted-foreground">Retries: {ev.retry_count}</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{formatDate(ev.created_at)}</span>
            </div>
            <div className="text-xs font-mono text-red-600 dark:text-red-400 mt-1 bg-red-50 dark:bg-red-950/20 p-2 rounded">
              {ev.error}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
