'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@/lib/wallet'
import { daoRead, daoWrite, InvokeError } from '@/lib/dao-client'
import { backend } from '@/lib/backend'
import { useWriteAction } from '@/hooks/use-write-action'
import { useAdminAuditLog } from '@/hooks/use-admin-audit-log'
import { isStellarAddress } from '@/lib/stellar'
import toast from 'react-hot-toast'

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
      )}

      {tab === 'loans' && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-xl font-bold text-white">Loan Management</h2>
          <p className="mt-1 text-sm text-zinc-400">Review and manage active protocol loans.</p>
        </div>
      )}

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
              </tbody>
            </table>
          </div>

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
