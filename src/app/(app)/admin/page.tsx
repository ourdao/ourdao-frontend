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
  usePendingPolicyUpdate,
  useRawLoanPolicy,
} from '@/hooks/useDAO'
import type { FailedEventResolution } from '@/lib/backend'
import { AddressLink } from '@/components/AddressLink'
import { LoadError } from '@/components/LoadError'
import { useAnnounceLoad } from '@/lib/useAnnounceLoad'
import { formatToken, formatDate, formatThreshold } from '@/lib/utils'
import { formatStellarAddress, isStellarAddress } from '@/lib/stellar'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/ui/stat-card'
import { useNow } from '@/hooks/useNow'
import type { LoanPolicy } from '@/lib/dao-client'

type Tab = 'overview' | 'treasury' | 'governance' | 'loans' | 'audit'

export default function AdminPage() {
  const { address, isConnected } = useWallet()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loadingRole, setLoadingRole] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')

  // Overview state
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [activeMembers, setActiveMembers] = useState<number | null>(null)
  const [consensusThreshold, setConsensusThreshold] = useState<number | null>(null)
  const [treasuryBalance, setTreasuryBalance] = useState<bigint | null>(null)
  const [isPaused, setIsPaused] = useState<boolean | null>(null)
  const [admins, setAdmins] = useState<string[] | null>(null)

  // Governance inputs
  const [newAdminInput, setNewAdminInput] = useState('')
  const [newThresholdInput, setNewThresholdInput] = useState('')

  // Audit log hook
  const { entries: auditEntries, loading: auditLoading, error: auditError, hasMore: auditHasMore, loadMore: auditLoadMore, refetch: auditRefetch } = useAdminAuditLog(10)

  const { execute: execPause, loading: pausing } = useWriteAction({
    action: async () => {
      const client = daoWrite()
      if (isPaused) {
        await client.unpause()
      } else {
        await client.pause()
      }
    },
    onSuccess: () => {
      toast.success(isPaused ? 'Unpaused successfully' : 'Paused successfully')
      loadOverview()
    },
  })

  const { execute: execAddAdmin, loading: addingAdmin } = useWriteAction({
    action: async () => {
      const client = daoWrite()
      await client.addAdmin(newAdminInput.trim())
    },
    onSuccess: () => {
      toast.success('Admin added successfully')
      setNewAdminInput('')
      loadOverview()
    },
  })

  const { execute: execSetThreshold, loading: settingThreshold } = useWriteAction({
    action: async () => {
      const val = parseInt(newThresholdInput, 10)
      if (isNaN(val) || val < 0 || val > 10000) {
        throw new Error('Threshold must be between 0 and 10000')
      }
      const client = daoWrite()
      await client.setConsensusThreshold(val)
    },
    onSuccess: () => {
      toast.success('Consensus threshold updated')
      setNewThresholdInput('')
      loadOverview()
    },
  })

  useEffect(() => {
    let mounted = true
    async function checkRole() {
      if (!isConnected || !address) {
        if (mounted) {
          setIsAdmin(false)
          setLoadingRole(false)
        }
        return
      }
      try {
        const adminStatus = await daoRead.isAdmin(address)
        if (mounted) {
          setIsAdmin(adminStatus)
          setLoadingRole(false)
        }
      } catch {
        if (mounted) {
          setIsAdmin(false)
          setLoadingRole(false)
        }
      }
    }
    checkRole()
    return () => { mounted = false }
  }, [isConnected, address])

  async function loadOverview() {
    try {
      const [tot, act, th, bal, paused, adm] = await Promise.all([
        daoRead.getTotalMembers(),
        daoRead.getActiveMembers(),
        daoRead.getConsensusThreshold(),
        daoRead.getTreasuryBalance(),
        daoRead.isPaused(),
        daoRead.getAdmins(),
      ])
      setMemberCount(Number(tot))
      setActiveMembers(Number(act))
      setConsensusThreshold(Number(th))
      setTreasuryBalance(bal)
      setIsPaused(paused)
      setAdmins(adm)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect({
    if (isAdmin) {
      loadOverview()
    }
  }, [isAdmin])

  if (loadingRole) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-zinc-400">Verifying admin permissions...</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <h1 className="text-2xl font-bold text-red-400">Access Denied</h1>
        <p className="mt-2 text-zinc-400">You do not have administrative privileges to view this page.</p>
      </div>
    )
  }

  const isValidNewAdmin = newAdminInput.trim() === '' || isStellarAddress(newAdminInput.trim())

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8 px-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-sm text-zinc-400">Manage DAO operations, governance, and review audit logs.</p>
        </div>
        <div>
          <button
            onClick={() => execPause()}
            disabled={pausing || isPaused === null}
            className={`rounded px-4 py-2 font-medium text-white transition ${
              isPaused ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {pausing ? 'Processing...' : isPaused ? 'Unpause Protocol' : 'Pause Protocol'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-zinc-800">
        {(['overview', 'treasury', 'governance', 'loans', 'audit'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-6 py-3 text-sm font-medium capitalize transition ${
              tab === t
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
            <h3 className="text-sm font-medium text-zinc-400">Total Members</h3>
            <p className="mt-2 text-3xl font-bold text-white">{memberCount ?? '—'}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
            <h3 className="text-sm font-medium text-zinc-400">Active Members</h3>
            <p className="mt-2 text-3xl font-bold text-white">{activeMembers ?? '—'}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
            <h3 className="text-sm font-medium text-zinc-400">Consensus Threshold</h3>
            <p className="mt-2 text-3xl font-bold text-white">
              {consensusThreshold !== null ? `${(consensusThreshold / 100).toFixed(2)}%` : '—'}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
            <h3 className="text-sm font-medium text-zinc-400">Protocol Status</h3>
            <p className={`mt-2 text-3xl font-bold ${isPaused ? 'text-red-400' : 'text-green-400'}`}>
              {isPaused === null ? '—' : isPaused ? 'Paused' : 'Active'}
            </p>
          </div>
        </div>
      )}

      {tab === 'treasury' && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-xl font-bold text-white">Treasury Management</h2>
          <p className="mt-1 text-sm text-zinc-400">Current balance and reserve breakdown.</p>
          <div className="mt-6">
            <p className="text-2xl font-semibold text-white">
              {treasuryBalance !== null ? `${treasuryBalance.toString()} XLM` : 'Loading...'}
            </p>
          </div>
        </div>
      )}

      {tab === 'governance' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-xl font-bold text-white">Add Administrator</h2>
            <p className="mt-1 text-sm text-zinc-400">Grant admin privileges to a Stellar address.</p>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="G… address to add as admin"
                  value={newAdminInput}
                  onChange={(e) => setNewAdminInput(e.target.value)}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
                {!isValidNewAdmin && (
                  <p className="mt-1 text-xs text-red-400">Enter a valid Stellar destination address (G… or C…)</p>
                )}
              </div>
              <button
                onClick={() => execAddAdmin()}
                disabled={addingAdmin || !newAdminInput.trim() || !isValidNewAdmin}
                className="rounded bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {addingAdmin ? 'Adding...' : 'Add Admin'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-xl font-bold text-white">Consensus Threshold</h2>
            <p className="mt-1 text-sm text-zinc-400">Set threshold basis points (e.g. 5100 for 51%).</p>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row">
              <input
                type="number"
                placeholder="e.g. 5100 for 51%"
                value={newThresholdInput}
                onChange={(e) => setNewThresholdInput(e.target.value)}
                className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={() => {
                  const val = parseFloat(newThresholdInput)
                  if (!Number.isInteger(val)) {
                    toast.error('Threshold must be an integer')
                    return
                  }
                  if (confirm('Are you sure you want to update the consensus threshold?')) {
                    execSetThreshold()
                  }
                }}
                disabled={settingThreshold || !newThresholdInput.trim()}
                className="rounded bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {settingThreshold ? 'Updating...' : 'Update Threshold'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-xl font-bold text-white">Current Administrators</h2>
            <ul className="mt-4 divide-y divide-zinc-800">
              {admins ? (
                admins.map((adm) => (
                  <li key={adm} className="py-2 font-mono text-sm text-zinc-300">{adm}</li>
                ))
              ) : (
                <li className="py-2 text-sm text-zinc-500">Loading admins...</li>
              )}
            </ul>
          </div>
        </div>
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

      {tab === 'audit' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Audit Log</h2>
              <p className="text-sm text-zinc-400">Review administrative actions performed across the protocol.</p>
            </div>
            <button
              onClick={() => auditRefetch()}
              className="rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
            >
              Refresh
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
  const {
    reEvaluate,
    isPending: isReEvaluating,
    error: reEvaluateError,
    result: reEvaluateResult,
  } = useReEvaluateFailedEvent()
  const {
    batchResolve,
    isPending: isResolving,
    error: batchError,
    result: batchResult,
  } = useBatchResolveFailedEvents()
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [resolution, setResolution] = useState<FailedEventResolution | ''>('')
  const [note, setNote] = useState('')

  const numericIds = failedEvents
    .map((ev) => Number(ev.id))
    .filter((id) => Number.isInteger(id) && id > 0)
  const allSelected = numericIds.length > 0 && numericIds.every((id) => selectedIds.includes(id))
  const isBusy = isReEvaluating || isResolving

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : numericIds)
  }
  const toggleOne = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]))
  }

  const submitBatch = async (event: FormEvent) => {
    event.preventDefault()
    if (!resolution || selectedIds.length === 0) return
    const message = `Resolve ${selectedIds.length} selected quarantined event(s) as ${resolution}?`
    if (!window.confirm(message)) return
    const outcome = await batchResolve({ ids: selectedIds, resolution, note: note.trim() || undefined })
    if (outcome) {
      setSelectedIds([])
      setResolution('')
      setNote('')
    }
  }

          <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/50">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-800/50 text-xs uppercase text-zinc-400">
                <tr>
                  <th scope="col" className="px-6 py-3 font-medium">Action</th>
                  <th scope="col" className="px-6 py-3 font-medium">Actor</th>
                  <th scope="col" className="px-6 py-3 font-medium">Target</th>
                  <th scope="col" className="px-6 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {auditLoading && (!auditEntries || auditEntries.length === 0) ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">Loading audit log...</td>
                  </tr>
                ) : auditError ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-red-400">Error: {auditError}</td>
                  </tr>
                ) : !auditEntries || auditEntries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">No audit log entries found.</td>
                  </tr>
                ) : (
                  auditEntries.map((entry, idx) => (
                    <tr key={entry.id || idx} className="hover:bg-zinc-800/30">
                      <td className="px-6 py-4 font-medium text-white">{entry.action}</td>
                      <td className="px-6 py-4 font-mono text-xs text-zinc-400">{entry.actor}</td>
                      <td className="px-6 py-4 font-mono text-xs text-zinc-400">{entry.target || '—'}</td>
                      <td className="px-6 py-4 text-zinc-400">{
                        typeof entry.timestamp === 'number'
                          ? new Date(entry.timestamp * 1000).toLocaleString()
                          : String(entry.timestamp)
                      }</td>
                    </tr>
                  ))
                )}
              </div>
              <span className="text-muted-foreground text-xs">{formatDate(ev.created_at)}</span>
            </div>
            <div className="mt-1 rounded bg-red-50 p-2 font-mono text-xs text-red-600 dark:bg-red-950/20 dark:text-red-400">
              {ev.error}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Every LoanPolicy field, in the order the contract stores them. Units follow
// the contract: basis points (bps), seconds (s), or stroops for the membership fee.
const POLICY_FIELDS: { key: keyof LoanPolicy; label: string }[] = [
  { key: 'min_interest_rate', label: 'Min interest rate (bps)' },
  { key: 'max_interest_rate', label: 'Max interest rate (bps)' },
  { key: 'max_loan_duration', label: 'Max loan duration (s)' },
  { key: 'max_loan_to_treasury_ratio', label: 'Max loan to treasury ratio (bps)' },
  { key: 'membership_contribution', label: 'Membership contribution (stroops)' },
  { key: 'min_membership_duration', label: 'Min membership duration (s)' },
  { key: 'cooldown_period', label: 'Cooldown period (s)' },
  { key: 'editing_period', label: 'Editing period (s)' },
  { key: 'voting_period', label: 'Voting period (s)' },
  { key: 'quorum_bps', label: 'Quorum (bps)' },
  { key: 'default_grace_period', label: 'Default grace period (s)' },
  { key: 'default_penalty_bps', label: 'Default penalty (bps)' },
]

function formatPolicyValue(value: unknown): string {
  return value === undefined || value === null ? '—' : String(value)
}

function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return 'Ready to execute'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  if (days === 0 && hours === 0 && minutes === 0) return 'Executable in less than a minute'
  return `Executable in ${days}d ${hours}h ${minutes}m`
}

/** Shows a queued policy change beside the live values. Renders nothing when no
 *  update is pending. Changed fields are marked in text, not only by colour. */
function PendingPolicyUpdatePanel() {
  const { pending } = usePendingPolicyUpdate()
  const current = useRawLoanPolicy()
  const nowMs = useNow()
  const { executePolicyUpdate, cancelPolicyUpdate, isPending: busy } = usePolicyUpdateActions()

  if (!pending) return null

  const nowSec = nowMs == null ? null : Math.floor(nowMs / 1000)
  const timeLeft =
    nowSec == null ? 'Checking time left…' : formatTimeLeft(pending.executionTime - nowSec)
  const ready = nowSec != null && nowSec >= pending.executionTime

  const onExecute = async () => {
    if (!ready) return
    if (!window.confirm('Execute the pending policy update? The new loan policy applies to every member immediately.')) return
    try {
      await executePolicyUpdate()
    } catch {
      // `run` has already shown the failure; nothing more to do here.
    }
  }

          {auditHasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => auditLoadMore()}
                disabled={auditLoading}
                className="rounded bg-zinc-800 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {auditLoading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
