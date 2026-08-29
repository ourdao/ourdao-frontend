import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// clsx alone only concatenates — it doesn't know that e.g. bg-white and
// bg-primary conflict, so which one visually wins depends on Tailwind's
// generated stylesheet order, not on which is later in the className
// string. twMerge resolves same-property conflicts by source order
// instead, so a caller's override classes reliably win over a component's
// own defaults (e.g. Button's default variant bg-primary/text-primary-foreground).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format a Soroban token amount (Stellar assets use 7 decimals) for display.
// Keeps full integer precision via BigInt; trims trailing fractional zeros.
//
// `decimals` is the token's actual precision (7 for Stellar assets);
// `displayDecimals` is how many fractional digits to *show* — a separate,
// named concern rather than a magic number buried in the slice call. When a
// value is non-zero but rounds away to nothing at display precision, this
// returns a "<0.0001"-style lower bound instead of the bare string '0', so
// the UI never claims a non-empty balance is empty (#61).
export function formatToken(
  value: bigint | string | number,
  { decimals = 7, displayDecimals = 4 }: { decimals?: number; displayDecimals?: number } = {}
): string {
  try {
    const v = typeof value === 'bigint' ? value : BigInt(String(value).split('.')[0] || '0')
    const neg = v < BigInt(0)
    const abs = neg ? -v : v
    const base = BigInt(10) ** BigInt(decimals)
    const whole = (abs / base).toString()
    const fracFull = (abs % base).toString().padStart(decimals, '0')
    const frac = fracFull.slice(0, displayDecimals).replace(/0+$/, '')

    if (whole === '0' && !frac && abs > BigInt(0)) {
      const bound = displayDecimals > 0 ? `0.${'0'.repeat(displayDecimals - 1)}1` : '1'
      return `${neg ? '-' : ''}<${bound}`
    }

    return `${neg ? '-' : ''}${whole}${frac ? '.' + frac : ''}`
  } catch {
    return '0'
  }
}

// Format dates to readable format
export function formatDate(timestamp: number | string | Date): string {
  try {
    let date: Date
    if (typeof timestamp === 'number') {
      // If it's a unix timestamp (seconds), convert to milliseconds
      date = timestamp < 10000000000 ? new Date(timestamp * 1000) : new Date(timestamp)
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp)
    } else {
      date = timestamp
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return 'Invalid date'
  }
}

// Format an address to shortened form
export function formatAddress(address: string, startLength: number = 6, endLength: number = 4): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`
}

// Calculate percentage for voting results
export function calculatePercentage(votes: number, totalVotes: number): number {
  if (totalVotes === 0) return 0
  return Math.round((votes / totalVotes) * 100)
}

// Parse a decimal string into a Soroban token amount (BigInt, 7-decimal default).
// Inverse of formatToken; splits on the decimal point instead of doing
// floating-point math, so precision isn't lost for large amounts.
export function parseToken(value: string, decimals: number = 7): bigint {
  try {
    const cleanValue = value.trim()
    if (!cleanValue || isNaN(Number(cleanValue))) {
      throw new Error('Invalid number')
    }
    // Strip the sign and negate the combined total at the end, rather than
    // negating just the whole part — BigInt has no negative zero, so
    // `BigInt('-0')` collapses to 0n and `BigInt('-5') * base + positiveFrac`
    // computes the wrong magnitude for any negative value with a fractional
    // part (e.g. "-5.25" previously round-tripped to -4.75).
    const neg = cleanValue.startsWith('-')
    const abs = neg ? cleanValue.slice(1) : cleanValue
    const [wholePart, fracPart = ''] = abs.split('.')
    const base = BigInt(10) ** BigInt(decimals)
    const whole = BigInt(wholePart || '0') * base
    const frac = BigInt((fracPart + '0'.repeat(decimals)).slice(0, decimals) || '0')
    const total = whole + frac
    return neg ? -total : total
  } catch {
    return BigInt(0)
  }
}

// Generate commitment for private voting (simple hash for demo)
export function generateCommitment(secret: string, data: string): string {
  try {
    // In a real app, this would use proper cryptographic commitment schemes
    // For demo purposes, we'll use a simple hash-like function
    const combined = secret + data
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16)
  } catch {
    return ''
  }
}
