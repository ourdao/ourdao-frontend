// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { WalletProvider, useWallet } from '@/lib/wallet'
import { useWriteAction } from '@/hooks/dao/writes'
import * as freighter from '@stellar/freighter-api'

vi.mock('@stellar/freighter-api', () => ({
  isAllowed: vi.fn().mockResolvedValue({ isAllowed: true }),
  requestAccess: vi.fn(),
  getAddress: vi.fn().mockResolvedValue({ address: 'ACCOUNT_SIGNER' }),
  getNetwork: vi.fn().mockResolvedValue({ network: 'TESTNET', networkPassphrase: 'Test SDF Network ; September 2015' }),
  signTransaction: vi.fn(),
  isConnected: vi.fn().mockResolvedValue({ isConnected: true, version: '2.5.0' }),
  WatchWalletChanges: vi.fn().mockImplementation(function () {
    return { watch: vi.fn(), stop: vi.fn() }
  }),
}))

vi.mock('@/lib/stellar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stellar')>()
  return {
    ...actual,
    NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
    getTransactionUrl: (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`,
  }
})

vi.mock('@/lib/dao-client', () => ({
  daoWrite: vi.fn().mockImplementation((addr, signer) => ({
    registerMember: async () => {
      await signer('XDR_TX')
      return { hash: '0x123', returnValue: null }
    }
  })),
  InvokeError: class InvokeError extends Error {
    retryable = true
  },
  // A submission window that closed without a confirmation is a distinct,
  // non-retryable outcome (#309) — useWriteAction branches on it.
  TransactionPendingError: class TransactionPendingError extends Error {
    hash = '0x123'
    url: string | null = null
    retryable = false
  },
  watchTransaction: vi.fn().mockResolvedValue('timeout'),
}))

function TestWriteHarness({ onRender }: { onRender: (w: ReturnType<typeof useWriteAction>) => void }) {
  const write = useWriteAction()
  onRender(write)
  return null
}

function renderWriteProvider(queryClient: QueryClient, onRender: (w: ReturnType<typeof useWriteAction>) => void) {
  return render(
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <TestWriteHarness onRender={onRender} />
      </WalletProvider>
    </QueryClientProvider>
  )
}

describe('Issue #221 — Bounded signature request & cancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(freighter.isAllowed).mockResolvedValue({ isAllowed: true } as never)
    vi.mocked(freighter.getAddress).mockResolvedValue({ address: 'ACCOUNT_SIGNER' } as never)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('times out when signature request never resolves', async () => {
    // Return a promise that never resolves
    vi.mocked(freighter.signTransaction).mockReturnValue(new Promise(() => {}))

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    let writeHook: ReturnType<typeof useWriteAction> | undefined

    renderWriteProvider(qc, (w) => { writeHook = w })

    await waitFor(() => expect(writeHook?.address).toBe('ACCOUNT_SIGNER'))

    let actionPromise: Promise<unknown> | undefined
    act(() => {
      actionPromise = writeHook!.run('Testing', (w) => w.registerMember())
    })

    expect(writeHook?.isPending).toBe(true)

    // Attach handler before advancing timers to avoid unhandled rejection in act
    const assertion = expect(actionPromise).rejects.toThrow(/timed out/)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61000)
    })

    await assertion
    expect(writeHook?.isPending).toBe(false)
    expect(writeHook?.isRetryable).toBe(true)
  })

  it('restores UI cleanly when member cancels pending signature', async () => {
    vi.mocked(freighter.signTransaction).mockReturnValue(new Promise(() => {}))

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    let writeHook: ReturnType<typeof useWriteAction> | undefined

    renderWriteProvider(qc, (w) => { writeHook = w })

    await waitFor(() => expect(writeHook?.address).toBe('ACCOUNT_SIGNER'))

    let actionPromise: Promise<unknown> | undefined
    act(() => {
      actionPromise = writeHook!.run('Testing Cancel', (w) => w.registerMember())
    })

    expect(writeHook?.isPending).toBe(true)

    act(() => {
      writeHook!.cancelSignature()
    })

    await expect(actionPromise).rejects.toThrow(/cancelled/)
    expect(writeHook?.isPending).toBe(false)
    expect(writeHook?.isRetryable).toBe(true)
  })
});

function TestSignHarness({ onRender }: { onRender: (w: ReturnType<typeof useWallet>) => void }) {
  const wallet = useWallet()
  onRender(wallet)
  return null
}

function renderWalletOnly(onRender: (w: ReturnType<typeof useWallet>) => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <WalletProvider>
        <TestSignHarness onRender={onRender} />
      </WalletProvider>
    </QueryClientProvider>
  )
}

describe('Issue #599 — signXDR clears its timeout timer and abort listener on completion', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(freighter.isAllowed).mockResolvedValue({ isAllowed: true } as never)
    vi.mocked(freighter.getAddress).mockResolvedValue({ address: 'ACCOUNT_SIGNER' } as never)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('leaves no pending timer after a signature resolves normally', async () => {
    vi.mocked(freighter.signTransaction).mockResolvedValue({ signedTxXdr: 'SIGNED_XDR' } as never)

    let wallet: ReturnType<typeof useWallet> | undefined
    renderWalletOnly((w) => { wallet = w })

    await waitFor(() => expect(wallet?.address).toBe('ACCOUNT_SIGNER'))

    // Before the fix, the setTimeout from signXDR's race kept running after a
    // successful sign — it was only ever cleared inside the abort listener.
    await act(async () => {
      await wallet!.signXDR('SOME_XDR')
    })

    expect(vi.getTimerCount()).toBe(0)
  })

  it('removes the abort listener from the caller-supplied signal once signing completes', async () => {
    vi.mocked(freighter.signTransaction).mockResolvedValue({ signedTxXdr: 'SIGNED_XDR' } as never)

    let wallet: ReturnType<typeof useWallet> | undefined
    renderWalletOnly((w) => { wallet = w })

    await waitFor(() => expect(wallet?.address).toBe('ACCOUNT_SIGNER'))

    const controller = new AbortController()
    const removeSpy = vi.spyOn(controller.signal, 'removeEventListener')

    await act(async () => {
      await wallet!.signXDR('SOME_XDR', { signal: controller.signal })
    })

    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it('still rejects with "Signing timed out" when the wallet never responds', async () => {
    vi.mocked(freighter.signTransaction).mockReturnValue(new Promise(() => {}))

    let wallet: ReturnType<typeof useWallet> | undefined
    renderWalletOnly((w) => { wallet = w })

    await waitFor(() => expect(wallet?.address).toBe('ACCOUNT_SIGNER'))

    let signPromise: Promise<unknown> | undefined
    act(() => {
      signPromise = wallet!.signXDR('SOME_XDR', { timeoutMs: 1000 })
    })

    const assertion = expect(signPromise).rejects.toThrow(/timed out/)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })

  it('still rejects with "Signing cancelled" when the caller aborts, and clears the timer', async () => {
    vi.mocked(freighter.signTransaction).mockReturnValue(new Promise(() => {}))

    let wallet: ReturnType<typeof useWallet> | undefined
    renderWalletOnly((w) => { wallet = w })

    await waitFor(() => expect(wallet?.address).toBe('ACCOUNT_SIGNER'))

    const controller = new AbortController()
    let signPromise: Promise<unknown> | undefined
    act(() => {
      signPromise = wallet!.signXDR('SOME_XDR', { timeoutMs: 60_000, signal: controller.signal })
    })

    const assertion = expect(signPromise).rejects.toThrow(/cancelled/)
    act(() => {
      controller.abort()
    })
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })
});
