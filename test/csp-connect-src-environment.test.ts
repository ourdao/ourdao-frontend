import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildCspWithNonce } from '@/proxy'

/** The connect-src directive of the policy built for a request. */
const connectSrc = (): string => {
  const directive = buildCspWithNonce('test-nonce').split('; ').find((d) => d.startsWith('connect-src '))
  if (!directive) throw new Error('connect-src directive missing')
  return directive
}

describe('connect-src origins by environment (#577)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('production allows no localhost origin when none is configured', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', '')

    expect(connectSrc()).not.toMatch(/localhost/)
    expect(connectSrc()).not.toContain('ws://localhost:*')
  })

  it('production allows the configured backend and its websocket, not localhost', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'https://api.ourdao.example')

    const directive = connectSrc()
    expect(directive).toContain('https://api.ourdao.example')
    expect(directive).toContain('wss://api.ourdao.example')
    expect(directive).not.toMatch(/localhost/)
  })

  it('production still allows a localhost backend when it is configured explicitly', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'http://localhost:4000')

    expect(connectSrc()).toContain('ws://localhost:4000')
  })

  it('development keeps the HMR websockets and the localhost backend default', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', '')

    const directive = connectSrc()
    expect(directive).toContain('ws://localhost:*')
    expect(directive).toContain('wss://localhost:*')
    expect(directive).toContain('http://localhost:4000')
    expect(directive).toContain('ws://localhost:4000')
  })
})
