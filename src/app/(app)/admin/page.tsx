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
  useWhitelistedTokens,
  useTokenWhitelist,
  usePauserActions,
  useAuditLog,
  useReevaluateFailedEvent,
  useBatchResolveFailedEvents,
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
              aria-label="Address to add as admin"
              aria-invalid={newAdminError}
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
            aria-label="Consensus threshold in basis points"
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

      <PauserSection />
      <TokenWhitelistSection />
    </div>
  )
}

/** Pauser assignment controls (#629). The pauser can pause but only an admin
 *  can unpause (per the contract CHANGELOG, #319). */
function PauserSection() {
  const { setPauser, revokePauser, isPending } = usePauserActions()
  const [pauserAddr, setPauserAddr] = useState('')

  const trimmed = pauserAddr.trim()
  const addrError = trimmed.length > 0 && !isStellarAddress(trimmed)

  const submitSetPauser = async (e: FormEvent) => {
    e.preventDefault()
    if (!trimmed || !isStellarAddress(trimmed)) return
    if (!window.confirm(`Set ${formatStellarAddress(trimmed)} as the pauser? They will be able to pause the DAO, but only an admin can unpause it.`)) return
    try {
      await setPauser(trimmed)
    } catch {
      return
    }
    setPauserAddr('')
  }

  const submitRevoke = async () => {
    if (!window.confirm('Revoke the pauser role? The current pauser will no longer be able to pause the DAO. Only an admin can pause it afterwards.')) return
    try {
      await revokePauser()
    } catch {
      return
    }
  }

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Pauser</h3>
        <p className="text-sm text-muted-foreground">
          Assign a dedicated address that can pause the DAO. Only an admin can unpause it.
        </p>
      </div>
      <div className="p-6 space-y-4">
        <form onSubmit={submitSetPauser} className="flex items-start space-x-2">
          <div className="flex-1">
            <input
              type="text"
              value={pauserAddr}
              onChange={(e) => setPauserAddr(e.target.value)}
              placeholder="G… address to set as pauser"
              aria-label="Address to set as pauser"
              aria-invalid={addrError}
              aria-describedby={addrError ? 'pauser-addr-error' : undefined}
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-muted dark:text-foreground"
            />
            {addrError && (
              <p id="pauser-addr-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                Enter a valid Stellar address (G… or C…)
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isPending || !trimmed || !isStellarAddress(trimmed)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Set Pauser
          </button>
        </form>
        <button
          onClick={submitRevoke}
          disabled={isPending}
          className="flex items-center space-x-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm disabled:opacity-40"
        >
          <TrashIcon className="h-4 w-4" />
          <span>Revoke Pauser</span>
        </button>
      </div>
    </div>
  )
}

/** Supported assets (token whitelist) controls (#623). Admins can propose a
 *  token addition (48 h timelock), execute once the timelock expires, and
 *  remove a token immediately. The base token cannot be removed. */
function TokenWhitelistSection() {
  const { tokens, isLoading: tokensLoading, isError: tokensError, refetch: refetchTokens } = useWhitelistedTokens()
  const { proposeTokenAddition, executeTokenAddition, removeToken, isPending } = useTokenWhitelist()
  const [tokenAddr, setTokenAddr] = useState('')
  const [executeAddr, setExecuteAddr] = useState('')

  const trimmed = tokenAddr.trim()
  const addrError = trimmed.length > 0 && !isStellarAddress(trimmed)
  const executeTrimmed = executeAddr.trim()
  const executeError = executeTrimmed.length > 0 && !isStellarAddress(executeTrimmed)

  // The base token (the DAO's own token) should not be removable. We compare
  // against the token read from the contract, available via useDAOStats or a
  // separate read. For now we use the first token in the list as a heuristic
  // since the contract always includes it — a more precise check would read
  // `get_token()` and compare.

  const submitPropose = async (e: FormEvent) => {
    e.preventDefault()
    if (!trimmed || !isStellarAddress(trimmed)) return
    try {
      await proposeTokenAddition(trimmed)
    } catch {
      return
    }
    setTokenAddr('')
    refetchTokens()
  }

  const submitExecute = async (e: FormEvent) => {
    e.preventDefault()
    if (!executeTrimmed || !isStellarAddress(executeTrimmed)) return
    try {
      await executeTokenAddition(executeTrimmed)
    } catch {
      return
    }
    setExecuteAddr('')
    refetchTokens()
  }

  const submitRemove = async (token: string) => {
    if (!window.confirm(`Remove ${formatStellarAddress(token)} from the whitelist? This takes effect immediately and blocks new loans and withdrawals in that asset. Existing loans can still be repaid.`)) return
    try {
      await removeToken(token)
    } catch {
      return
    }
    refetchTokens()
  }

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Supported Assets</h3>
        <p className="text-sm text-muted-foreground">
          Whitelisted tokens the DAO accepts for loans and withdrawals. Additions require a 48-hour timelock.
        </p>
      </div>

      {/* Whitelisted token list */}
      <div className="divide-y divide-border">
        {tokensLoading && <div className="px-6 py-4 text-sm text-muted-foreground">Loading…</div>}
        {tokensError && <LoadError what="the whitelisted tokens" onRetry={() => void refetchTokens()} className="m-4" />}
        {!tokensLoading && !tokensError && tokens.length === 0 && (
          <div className="px-6 py-8 text-center text-muted-foreground">
            No whitelisted tokens found.
          </div>
        )}
        {tokens.map((token) => (
          <div key={token} className="px-6 py-3 flex items-center justify-between">
            <AddressLink address={token} className="text-sm text-foreground" />
            <button
              onClick={() => submitRemove(token)}
              disabled={isPending}
              className="flex items-center space-x-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm disabled:opacity-40"
            >
              <TrashIcon className="h-4 w-4" />
              <span>Remove</span>
            </button>
          </div>
        ))}
      </div>

      {/* Propose addition form */}
      <form onSubmit={submitPropose} className="p-6 flex items-start space-x-2 border-t border-border">
        <div className="flex-1">
          <label className="text-sm font-medium text-foreground mb-1 block">Propose token addition</label>
          <input
            type="text"
            value={tokenAddr}
            onChange={(e) => setTokenAddr(e.target.value)}
            placeholder="Token contract address (C…)"
            aria-label="Token address to propose"
            aria-invalid={addrError}
            aria-describedby={addrError ? 'token-addr-error' : undefined}
            className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-muted dark:text-foreground"
          />
          {addrError && (
            <p id="token-addr-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
              Enter a valid Stellar contract address (C…)
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isPending || !trimmed || !isStellarAddress(trimmed)}
          className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Propose
        </button>
      </form>

      {/* Execute addition form */}
      <form onSubmit={submitExecute} className="p-6 pt-0 flex items-start space-x-2">
        <div className="flex-1">
          <label className="text-sm font-medium text-foreground mb-1 block">Execute token addition</label>
          <p className="text-xs text-muted-foreground mb-1">
            Available 48 hours after the proposal. Enter the same token address you proposed.
          </p>
          <input
            type="text"
            value={executeAddr}
            onChange={(e) => setExecuteAddr(e.target.value)}
            placeholder="Token contract address (C…)"
            aria-label="Token address to execute"
            aria-invalid={executeError}
            aria-describedby={executeError ? 'execute-addr-error' : undefined}
            className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-muted dark:text-foreground"
          />
          {executeError && (
            <p id="execute-addr-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
              Enter a valid Stellar contract address (C…)
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isPending || !executeTrimmed || !isStellarAddress(executeTrimmed)}
          className="mt-6 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 dark:bg-green-500 dark:hover:bg-green-600"
        >
          Execute
        </button>
      </form>
    </div>
  )
}

function ActivityTab() {
  const { entries, isLoading, isError, refetch } = useAdminLog(100)
  const { entries: auditEntries, isLoading: auditLoading, isError: auditError, refetch: refetchAudit } = useAuditLog(100)
  useAnnounceLoad('Admin event history', isLoading, isError)

  return (
    <div className="space-y-6">
      {/* Backend audit log (#555) — records admin actions like pause/unpause,
          admin add/remove, threshold changes, reorg clears. */}
      <div className="bg-card rounded-lg border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Admin Audit Log</h3>
          <p className="text-sm text-muted-foreground">
            Backend-recorded admin actions: pause/unpause, admin changes, threshold updates, reorg clears, re-evaluations.
          </p>
        </div>
        <div className="divide-y divide-border">
          {auditLoading && <div className="px-6 py-4 text-sm text-muted-foreground">Loading audit log…</div>}
          {auditError && <LoadError what="the audit log" onRetry={() => void refetchAudit()} className="m-4" />}
          {!auditLoading && !auditError && auditEntries.length === 0 && (
            <div className="px-6 py-8 text-center text-muted-foreground">
              No admin audit log entries yet.
            </div>
          )}
          {auditEntries.map((entry) => (
            <div key={entry.id} className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="px-2 py-1 text-xs font-mono bg-muted text-foreground rounded">
                  {entry.action}
                </span>
                {entry.actor && (
                  <span className="text-sm text-muted-foreground">{formatStellarAddress(entry.actor)}</span>
                )}
                {entry.ledger != null && (
                  <span className="text-sm text-muted-foreground">Ledger {entry.ledger}</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Indexed on-chain event history */}
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
    </div>
  )
}

function QuarantinedEventsTab() {
  const { failedEvents, isLoading, isError, refetch } = useFailedEvents()
  const { reevaluate, isPending: reevalPending, error: reevalError } = useReevaluateFailedEvent()
  const { batchResolve, isPending: batchPending, error: batchError } = useBatchResolveFailedEvents()

  const handleReevaluate = async (id: number | string) => {
    const ok = await reevaluate(id)
    if (ok) refetch()
  }

  const handleBatchResolve = async () => {
    if (!window.confirm(`Batch-resolve all ${failedEvents.length} quarantined event(s)? This reprocesses each failed event.`)) return
    const ok = await batchResolve()
    if (ok) refetch()
  }

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Quarantined / Failed Events
          </h3>
          <p className="text-sm text-muted-foreground">
            Events that failed indexer handler processing and are quarantined for investigation.
          </p>
        </div>
        {failedEvents.length > 0 && (
          <button
            onClick={handleBatchResolve}
            disabled={batchPending || reevalPending}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {batchPending ? 'Resolving…' : 'Batch Resolve All'}
          </button>
        )}
      </div>
      {(reevalError || batchError) && (
        <div className="px-6 py-2 text-sm text-red-600 dark:text-red-400">
          {reevalError || batchError}
        </div>
      )}
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
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{formatDate(ev.created_at)}</span>
                <button
                  onClick={() => handleReevaluate(ev.id)}
                  disabled={reevalPending || batchPending}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Re-evaluate
                </button>
              </div>
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
