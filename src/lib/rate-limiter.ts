import { NextRequest } from 'next/server'

/**
 * Deployment Platform Note:
 * Next.js App Router API handlers run on serverless runtimes (e.g., Vercel Functions).
 * In-memory sliding-window maps are instance-local. For distributed or edge serverless
 * production deployments, edge-level limiters such as Vercel Edge Rate Limiting / Vercel Firewall
 * or Upstash Redis (`@upstash/ratelimit`) should be configured to enforce rate limits globally.
 */

export interface RateLimiterConfig {
  ipMaxRequests: number
  ipWindowMs: number
  memberMaxRequests: number
  memberWindowMs: number
}

function getEnvInt(key: string, defaultValue: number): number {
  const val = process.env[key]
  if (!val) return defaultValue
  const parsed = parseInt(val, 10)
  return isNaN(parsed) || parsed <= 0 ? defaultValue : parsed
}

export function getRateLimiterConfig(): RateLimiterConfig {
  return {
    ipMaxRequests: getEnvInt('RATE_LIMIT_IP_MAX', 10),
    ipWindowMs: getEnvInt('RATE_LIMIT_IP_WINDOW_MS', 60000),
    memberMaxRequests: getEnvInt('RATE_LIMIT_MEMBER_MAX', 5),
    memberWindowMs: getEnvInt('RATE_LIMIT_MEMBER_WINDOW_MS', 60000),
  }
}

// In-memory sliding-window stores tracking timestamps of requests
const ipStore = new Map<string, number[]>()
const memberStore = new Map<string, number[]>()

/** How often keys whose timestamps have all expired are swept out of both stores (#576). */
const SWEEP_INTERVAL_MS = 60_000
let lastSweepAt = 0

export function resetRateLimits(): void {
  ipStore.clear()
  memberStore.clear()
  lastSweepAt = 0
}

/** Number of keys tracked across both stores. Used by tests and diagnostics. */
export function getRateLimitStoreSize(): number {
  return ipStore.size + memberStore.size
}

/** Keeps a key only while it still has live timestamps, so clients that went idle do not stay in memory. */
function storeTimestamps(store: Map<string, number[]>, key: string, timestamps: number[]): void {
  if (timestamps.length > 0) store.set(key, timestamps)
  else store.delete(key)
}

function sweepStore(store: Map<string, number[]>, windowMs: number, now: number): void {
  for (const [key, timestamps] of store) {
    storeTimestamps(store, key, timestamps.filter((ts) => now - ts < windowMs))
  }
}

/** Sweeps both stores at most once per SWEEP_INTERVAL_MS, so the cost is spread across requests. */
function sweepIdleKeys(config: RateLimiterConfig, now: number): void {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return
  lastSweepAt = now
  sweepStore(ipStore, config.ipWindowMs, now)
  sweepStore(memberStore, config.memberWindowMs, now)
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim())
    if (ips[0]) return ips[0]
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return '127.0.0.1'
}

export function getMemberAddress(req: NextRequest): string | null {
  const address =
    req.headers.get('x-member-address') ||
    req.headers.get('x-user-address') ||
    req.headers.get('x-stellar-address')
  return address ? address.trim() : null
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds?: number
  limitType?: 'ip' | 'member'
}

export function checkRateLimit(req: NextRequest): RateLimitResult {
  const config = getRateLimiterConfig()
  const now = Date.now()
  sweepIdleKeys(config, now)

  const memberAddress = getMemberAddress(req)
  const ip = getClientIp(req)

  // Check authenticated per-member rate limit first (tighter control)
  if (memberAddress) {
    const memberTimestamps = (memberStore.get(memberAddress) || []).filter(
      (ts) => now - ts < config.memberWindowMs
    )
    storeTimestamps(memberStore, memberAddress, memberTimestamps)

    if (memberTimestamps.length >= config.memberMaxRequests) {
      const oldest = memberTimestamps[0]
      const resetTime = oldest + config.memberWindowMs
      const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000))
      return {
        allowed: false,
        retryAfterSeconds,
        limitType: 'member',
      }
    }
  }

  // Check per-IP rate limit
  const ipTimestamps = (ipStore.get(ip) || []).filter(
    (ts) => now - ts < config.ipWindowMs
  )
  storeTimestamps(ipStore, ip, ipTimestamps)

  if (ipTimestamps.length >= config.ipMaxRequests) {
    const oldest = ipTimestamps[0]
    const resetTime = oldest + config.ipWindowMs
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000))
    return {
      allowed: false,
      retryAfterSeconds,
      limitType: 'ip',
    }
  }

  // Record timestamp
  if (memberAddress) {
    const timestamps = memberStore.get(memberAddress) || []
    timestamps.push(now)
    memberStore.set(memberAddress, timestamps)
  }
  const timestamps = ipStore.get(ip) || []
  timestamps.push(now)
  ipStore.set(ip, timestamps)

  return { allowed: true }
}
