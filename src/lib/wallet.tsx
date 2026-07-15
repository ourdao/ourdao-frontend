'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import {
  isAllowed,
  requestAccess,
  getAddress,
  signTransaction,
} from '@stellar/freighter-api'
import toast from 'react-hot-toast'
import { NETWORK_PASSPHRASE } from './stellar'

interface WalletContextValue {
  address: string | null
  isConnected: boolean
  connecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
  /** Signs a base64 transaction XDR with Freighter and returns the signed XDR. */
  signXDR: (xdr: string) => Promise<string>
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined)

// Freighter's API has shifted return shapes across versions (bare string vs.
// `{ address }` vs. `{ address, error }`). These normalize both worlds.
function readAddress(res: unknown): { address: string; error?: string } {
  if (typeof res === 'string') return { address: res }
  const r = (res || {}) as { address?: string; error?: unknown }
  return { address: r.address || '', error: r.error ? String(r.error) : undefined }
}

function readSigned(res: unknown): { signedTxXdr: string; error?: string } {
  if (typeof res === 'string') return { signedTxXdr: res }
  const r = (res || {}) as { signedTxXdr?: string; error?: unknown }
  return {
    signedTxXdr: r.signedTxXdr || '',
    error: r.error ? String(r.error) : undefined,
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  // Restore a previously-authorized session on load (no popup if already allowed).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const allowed = await isAllowed()
        const ok = typeof allowed === 'boolean' ? allowed : allowed?.isAllowed
        if (ok && !cancelled) {
          const { address: addr } = readAddress(await getAddress())
          if (addr && !cancelled) setAddress(addr)
        }
      } catch {
        /* Freighter not installed — stay disconnected. */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const connect = useCallback(async () => {
    setConnecting(true)
    try {
      const { address: addr, error } = readAddress(await requestAccess())
      if (error || !addr) {
        toast.error(
          error
            ? `Wallet connection failed: ${error}`
            : 'Could not connect. Is the Freighter extension installed?'
        )
        return
      }
      setAddress(addr)
      toast.success('Wallet connected')
    } catch {
      toast.error('Freighter wallet not found. Install it at freighter.app')
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    // Freighter has no revoke API; we simply forget the session in-app.
    setAddress(null)
    toast('Wallet disconnected')
  }, [])

  const signXDR = useCallback(
    async (xdr: string): Promise<string> => {
      if (!address) throw new Error('Wallet not connected')
      const { signedTxXdr, error } = readSigned(
        await signTransaction(xdr, {
          networkPassphrase: NETWORK_PASSPHRASE,
          address,
        })
      )
      if (error || !signedTxXdr) {
        throw new Error(error || 'Transaction signing was rejected')
      }
      return signedTxXdr
    },
    [address]
  )

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        connecting,
        connect,
        disconnect,
        signXDR,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider')
  return ctx
}
