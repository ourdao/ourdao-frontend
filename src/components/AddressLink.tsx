'use client'

import { useCallback, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'

import { formatStellarAddress, getAddressUrl, getContractUrl } from '@/lib/stellar'
import { cn } from '@/lib/utils'

interface AddressLinkProps {
  /** Full Stellar address or contract id. */
  address: string
  /**
   * Whether `address` is an account (`G…`/`M…`) or a contract (`C…`). Decides
   * which explorer route the link points at. Defaults to `account`.
   */
  kind?: 'account' | 'contract'
  /** Characters to show on each side of the ellipsis in the truncated form. */
  chars?: number
  /** Overrides the visible text; the copy button still copies the full address. */
  label?: string
  className?: string
}

/**
 * Displays a truncated Stellar address with a button to copy the full value and
 * a link to open it on the block explorer (#394).
 *
 * The explorer link is rendered only when the configured network has an explorer
 * (`getAddressUrl`/`getContractUrl` return `null` for custom/unsupported networks,
 * e.g. Futurenet — a wrong link is worse than none). The full address is always
 * copyable and is exposed via `title` for pointer users regardless of network.
 */
export function AddressLink({
  address,
  kind = 'account',
  chars = 4,
  label,
  className,
}: AddressLinkProps) {
  const [copied, setCopied] = useState(false)

  const explorerUrl = kind === 'contract' ? getContractUrl(address) : getAddressUrl(address)
  const display = label ?? formatStellarAddress(address, chars)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      // Revert the icon after a moment. If the component unmounts first the
      // stray state update is harmless — React just drops it.
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard is unavailable (insecure context, or permission denied). The
      // full address is still shown via `title`, so this degrades, not breaks.
    }
  }, [address])

  if (!address) return null

  return (
    <span className={cn('inline-flex items-center gap-1 align-middle', className)}>
      <span className="font-mono" title={address}>
        {display}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Address copied' : 'Copy full address'}
        title={copied ? 'Copied' : 'Copy full address'}
        className="inline-flex shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View on block explorer"
          title="View on block explorer"
          className="inline-flex shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
    </span>
  )
}
