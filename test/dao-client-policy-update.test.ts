// @vitest-environment node
//
// Same Node-environment opt-in as dao-client-writes.test.ts (Keypair.random()
// does not work with jsdom's crypto polyfill).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Account,
  Keypair,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk'
import type { LoanPolicy } from '@/lib/dao-client'

const mockGetAccount = vi.fn()
const mockPrepareTransaction = vi.fn()
const mockSendTransaction = vi.fn()
const mockGetTransaction = vi.fn()
const mockSimulateTransaction = vi.fn()
const mockContractId = StrKey.encodeContract(Buffer.alloc(32))

vi.mock('@/lib/stellar', () => ({
  CONTRACT_ID: mockContractId,
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  isContractConfigured: () => true,
  getTransactionUrl: (hash: string) => `https://example.test/tx/${hash}`,
  server: {
    getAccount: (...a: unknown[]) => mockGetAccount(...a),
    prepareTransaction: (...a: unknown[]) => mockPrepareTransaction(...a),
    sendTransaction: (...a: unknown[]) => mockSendTransaction(...a),
    getTransaction: (...a: unknown[]) => mockGetTransaction(...a),
    simulateTransaction: (...a: unknown[]) => mockSimulateTransaction(...a),
  },
}))

const { daoWrite, daoRead } = await import('@/lib/dao-client')

const WALLET = Keypair.random().publicKey()

const POLICY: LoanPolicy = {
  cooldown_period: BigInt(600),
  default_grace_period: BigInt(86_400),
  default_penalty_bps: 500,
  editing_period: BigInt(3_600),
  max_interest_rate: 2_000,
  max_loan_duration: BigInt(7_776_000),
  max_loan_to_treasury_ratio: 2_500,
  membership_contribution: BigInt(10_000_000),
  min_interest_rate: 100,
  min_membership_duration: BigInt(2_592_000),
  quorum_bps: 5_000,
  voting_period: BigInt(259_200),
}

/** The single invoked contract call carried by a signed transaction. */
function invokedCall(signedXdr: string) {
  const tx = TransactionBuilder.fromXDR(signedXdr, 'Test SDF Network ; September 2015')
  const op = (tx as unknown as {
    operations: Array<{ func: { invokeContract: { functionName: { toString(): string }; args: xdr.ScVal[] } } }>
  }).operations[0]
  const call = op.func.invokeContract
  return { method: call.functionName.toString(), args: call.args }
}

describe('policy-update write wrappers', () => {
  let signed: string[]
  const signXDR = async (x: string) => {
    signed.push(x)
    return x
  }

  beforeEach(() => {
    signed = []
    mockGetAccount.mockResolvedValue(new Account(WALLET, '0'))
    mockPrepareTransaction.mockImplementation(async (tx) => tx)
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'abc' })
    mockGetTransaction.mockResolvedValue({ status: 'SUCCESS', returnValue: undefined })
  })

  afterEach(() => vi.clearAllMocks())

  it('proposePolicyUpdate submits every LoanPolicy field as the policy argument', async () => {
    await daoWrite(WALLET, signXDR).proposePolicyUpdate(POLICY)

    const { method, args } = invokedCall(signed[0])
    expect(method).toBe('propose_policy_update')
    expect(Object.keys(scValToNative(args[1])).sort()).toEqual(Object.keys(POLICY).sort())
    expect(Number(scValToNative(args[1]).quorum_bps)).toBe(5_000)
  })

  it('executePolicyUpdate calls execute_policy_update with only the caller', async () => {
    await daoWrite(WALLET, signXDR).executePolicyUpdate()

    const { method, args } = invokedCall(signed[0])
    expect(method).toBe('execute_policy_update')
    expect(args).toHaveLength(1)
  })

  it('cancelPolicyUpdate calls cancel_policy_update with only the caller', async () => {
    await daoWrite(WALLET, signXDR).cancelPolicyUpdate()

    const { method, args } = invokedCall(signed[0])
    expect(method).toBe('cancel_policy_update')
    expect(args).toHaveLength(1)
  })

  it('maps TimelockNotExpired (#76) to a readable message, never a raw code', async () => {
    mockSendTransaction.mockResolvedValue({ status: 'ERROR', hash: 'h', errorResult: '[#76]' })
    const err = await daoWrite(WALLET, signXDR).executePolicyUpdate().catch((e: Error) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe(
      'The timelock has not expired yet — this change cannot be applied until the delay has passed.'
    )
    expect((err as Error).message).not.toMatch(/#76/)
  })

  it('maps NoPendingPolicy (#77) to a readable message on execute and on cancel', async () => {
    mockSendTransaction.mockResolvedValue({ status: 'ERROR', hash: 'h', errorResult: '[#77]' })
    await expect(daoWrite(WALLET, signXDR).executePolicyUpdate()).rejects.toThrow(
      'There is no pending policy update to apply.'
    )
    await expect(daoWrite(WALLET, signXDR).cancelPolicyUpdate()).rejects.toThrow(
      'There is no pending policy update to apply.'
    )
  })
})

describe('daoRead.getPendingPolicyUpdate', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns null when no update is pending (Option::None)', async () => {
    mockSimulateTransaction.mockResolvedValue({
      id: '1',
      latestLedger: 1,
      events: [],
      _parsed: true,
      result: { auth: [], retval: xdr.ScVal.scvVoid() },
    })
    await expect(daoRead.getPendingPolicyUpdate()).resolves.toBeNull()
  })

  it('returns null when the simulation yields no return value', async () => {
    mockSimulateTransaction.mockResolvedValue({ id: '1', latestLedger: 1, events: [], _parsed: true })
    await expect(daoRead.getPendingPolicyUpdate()).resolves.toBeNull()
  })

  it('exposes proposedAt and executionTime as plain numbers in seconds', async () => {
    const retval = nativeToScVal({
      policy: { quorum_bps: 5_000 },
      proposed_at: BigInt(1_000),
      execution_time: BigInt(173_800),
    })
    mockSimulateTransaction.mockResolvedValue({
      id: '1',
      latestLedger: 1,
      events: [],
      _parsed: true,
      result: { auth: [], retval },
    })
    const pending = await daoRead.getPendingPolicyUpdate()
    expect(pending).not.toBeNull()
    expect(pending!.proposedAt).toBe(1_000)
    expect(pending!.executionTime).toBe(173_800)
    expect(typeof pending!.executionTime).toBe('number')
    expect(Number(pending!.policy.quorum_bps)).toBe(5_000)
  })

  it('throws a readable error when the read itself fails with a contract code', async () => {
    mockSimulateTransaction.mockResolvedValue({
      id: '1',
      latestLedger: 1,
      events: [],
      _parsed: true,
      error: 'HostError: Error(Contract, [#77])',
    })
    await expect(daoRead.getPendingPolicyUpdate()).rejects.toThrow(
      'There is no pending policy update to apply.'
    )
  })
})
