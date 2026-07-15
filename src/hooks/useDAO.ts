'use client'

import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { useWallet } from '@/lib/wallet'
import { CONTRACT_ID, isContractConfigured } from '@/lib/stellar'
import { daoRead, daoWrite } from '@/lib/dao-client'
import type { UserData, DAOStats } from '@/types/dao'
import { MemberStatus } from '@/types/dao'

// A Soroban unit-enum decodes as either a bare symbol string or a one-element
// array of it; normalize both to our numeric MemberStatus.
function toMemberStatus(raw: unknown): MemberStatus {
  const tag = Array.isArray(raw) ? raw[0] : raw
  return tag === 'ActiveMember' ? MemberStatus.ACTIVE_MEMBER : MemberStatus.INACTIVE_MEMBER
}

const asBigInt = (v: unknown): bigint => {
  try {
    return typeof v === 'bigint' ? v : BigInt((v as number | string) ?? 0)
  } catch {
    return BigInt(0)
  }
}

export function useDAOContract() {
  return { contractId: CONTRACT_ID, configured: isContractConfigured() }
}

/** Aggregated data for the connected member. */
export function useUserData(): UserData {
  const { address, isConnected } = useWallet()

  const { data } = useQuery({
    queryKey: ['userData', address],
    enabled: !!address && isContractConfigured(),
    queryFn: async () => {
      const [isMember, isAdmin, member, pendingYield] = await Promise.all([
        daoRead.isMember(address!),
        daoRead.isAdmin(address!),
        daoRead.getMember(address!),
        daoRead.getPendingYield(address!),
      ])
      return { isMember, isAdmin, member, pendingYield }
    },
  })

  const m = data?.member
  return {
    isConnected,
    address: address || undefined,
    isMember: !!data?.isMember,
    isAdmin: !!data?.isAdmin,
    member: m
      ? {
          memberAddress: String(m.address ?? address),
          status: toMemberStatus(m.status),
          joinDate: Number(m.join_ledger ?? 0),
          contributionAmount: asBigInt(m.contribution),
          shareBalance: asBigInt(m.share_balance),
          hasActiveLoan: !!m.has_active_loan,
          lastLoanDate: Number(m.last_loan_time ?? 0),
        }
      : undefined,
    votingWeight: 1,
    pendingRewards: asBigInt(data?.pendingYield),
    pendingYield: asBigInt(data?.pendingYield),
    hasActiveLoan: !!m?.has_active_loan,
    loans: [],
  }
}

type ExtendedStats = DAOStats & {
  initialized: boolean
  membershipFee: bigint
  consensusThreshold: number
  features: {
    ensVoting: boolean
    documentStorage: boolean
    privateVoting: boolean
    confidentialLoans: boolean
    restaking: boolean
  }
}

export function useDAOStats(): ExtendedStats {
  const { data } = useQuery({
    queryKey: ['daoStats'],
    enabled: isContractConfigured(),
    queryFn: async () => {
      const [totalMembers, activeMembers, threshold, treasury, policy] =
        await Promise.all([
          daoRead.getTotalMembers(),
          daoRead.getActiveMembers(),
          daoRead.getConsensusThreshold(),
          daoRead.getTreasuryBalance(),
          daoRead.getLoanPolicy(),
        ])
      return { totalMembers, activeMembers, threshold, treasury, policy }
    },
  })

  const membershipFee = asBigInt(
    (data?.policy as Record<string, unknown> | undefined)?.membership_contribution
  )

  return {
    totalMembers: Number(data?.totalMembers ?? 0),
    activeMembers: Number(data?.activeMembers ?? 0),
    totalLoans: 0,
    activeLoans: 0,
    treasuryBalance: asBigInt(data?.treasury),
    totalYieldGenerated: BigInt(0),
    totalRestaked: BigInt(0),
    initialized: isContractConfigured() && data?.threshold != null,
    membershipFee,
    consensusThreshold: Number(data?.threshold ?? 0),
    // The Soroban port's native modules are always compiled in.
    features: {
      ensVoting: true, // name registry
      documentStorage: true, // content-hash metadata
      privateVoting: true, // commit-reveal
      confidentialLoans: false,
      restaking: true, // staking
    },
  }
}

/**
 * Shared plumbing for a write action: resolves the wallet + signer, tracks
 * pending/success/error, and surfaces toasts. Returns a runner plus state.
 */
function useWriteAction() {
  const { address, signXDR, isConnected } = useWallet()
  const [isPending, setPending] = useState(false)
  const [isSuccess, setSuccess] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const run = useCallback(
    async (
      label: string,
      fn: (w: ReturnType<typeof daoWrite>) => Promise<{ hash: string }>
    ) => {
      if (!isConnected || !address) {
        toast.error('Connect your wallet first')
        throw new Error('Wallet not connected')
      }
      setPending(true)
      setSuccess(false)
      setError(null)
      const toastId = toast.loading(`${label}…`)
      try {
        const res = await fn(daoWrite(address, signXDR))
        setSuccess(true)
        toast.success(`${label} confirmed`, { id: toastId })
        return res
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        toast.error(`${label} failed: ${e.message}`, { id: toastId })
        throw e
      } finally {
        setPending(false)
      }
    },
    [address, isConnected, signXDR]
  )

  return { run, isPending, isSuccess, error }
}

export function useMemberRegistration() {
  const { run, isPending, isSuccess, error } = useWriteAction()
  // Extra args kept for call-site compatibility; the Soroban contract pulls the
  // fee via the configured token and takes no ENS/KYC arguments.
  const registerMember = (_ensName?: string, _kycHash?: string, _fee?: bigint) =>
    run('Registering membership', (w) => w.registerMember())
  return { registerMember, isPending, error, isSuccess }
}

export function useLoanRequest() {
  const { run, isPending, isSuccess, error } = useWriteAction()
  const requestLoan = (
    amount: bigint,
    _isPrivate = false,
    _commitment?: string,
    _documentHash?: string
  ) => run('Requesting loan', (w) => w.requestLoan(amount))
  return { requestLoan, isPending, error, isSuccess }
}

export function useVoting() {
  const { run, isPending, isSuccess, error } = useWriteAction()
  const voteOnProposal = (proposalId: number, support: boolean) =>
    run('Casting vote', (w) => w.voteOnLoanProposal(proposalId, support))
  return { voteOnProposal, isPending, error, isSuccess }
}

export function useLoanRepayment() {
  const { run, isPending, isSuccess, error } = useWriteAction()
  // Repayment amount is derived on-chain (full outstanding); arg kept for compat.
  const repayLoan = (loanId: number, _amount?: bigint) =>
    run('Repaying loan', (w) => w.repayLoan(loanId))
  return { repayLoan, isPending, error, isSuccess }
}

export function useRewards() {
  const { run, isPending, isSuccess, error } = useWriteAction()
  const claimRewards = () => run('Claiming rewards', (w) => w.claimRewards())
  const claimYield = () => run('Claiming yield', (w) => w.claimRewards())
  return { claimRewards, claimYield, isPending, error, isSuccess }
}

// Soroban event streaming would poll the RPC's getEvents; kept as a no-op shell
// so existing consumers keep their shape. See src/lib/eventListener.ts for the
// richer notification layer.
export function useDAOEvents() {
  const [events, setEvents] = useState<Record<string, unknown>[]>([])
  return { events, setEvents }
}
