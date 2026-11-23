import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkRateLimit, getRateLimitStoreSize, resetRateLimits } from '@/lib/rate-limiter'

const T0 = new Date('2026-06-01T12:00:00Z')

function request(ip: string, member?: string): NextRequest {
  const headers: Record<string, string> = { 'x-forwarded-for': ip }
  if (member) headers['x-member-address'] = member
  return new NextRequest('http://localhost/api/documents', { headers })
}

describe('rate limiter store eviction (#576)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    resetRateLimits()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('removes keys whose timestamps have all expired once the window passes', () => {
    checkRateLimit(request('198.51.100.1', 'GMEMBERA'))
    checkRateLimit(request('198.51.100.2'))
    checkRateLimit(request('198.51.100.3'))
    expect(getRateLimitStoreSize()).toBe(4) // three IPs and one member

    vi.setSystemTime(new Date(T0.getTime() + 61_000)) // past the 60 s window
    expect(checkRateLimit(request('198.51.100.4')).allowed).toBe(true) // triggers a sweep

    expect(getRateLimitStoreSize()).toBe(1) // only the IP that just made a request remains
  })

  it('keeps keys that still have live timestamps', () => {
    checkRateLimit(request('198.51.100.1'))
    vi.setSystemTime(new Date(T0.getTime() + 30_000))
    checkRateLimit(request('198.51.100.2'))
    vi.setSystemTime(new Date(T0.getTime() + 61_000)) // the first IP has expired, the second has not

    checkRateLimit(request('198.51.100.3'))

    expect(getRateLimitStoreSize()).toBe(2)
  })

  it('keeps the 429 threshold and Retry-After unchanged', () => {
    vi.stubEnv('RATE_LIMIT_IP_MAX', '2')
    expect(checkRateLimit(request('198.51.100.9')).allowed).toBe(true)
    expect(checkRateLimit(request('198.51.100.9')).allowed).toBe(true)

    const blocked = checkRateLimit(request('198.51.100.9'))
    expect(blocked).toEqual({ allowed: false, retryAfterSeconds: 60, limitType: 'ip' })
  })
})
