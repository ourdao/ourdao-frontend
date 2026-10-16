import { describe, expect, it } from 'vitest'
import { isLoopbackUrl, validateRpcEndpoint } from '@/lib/stellar'

describe('RPC endpoint validation', () => {
  it('correctly identifies loopback addresses', () => {
    expect(isLoopbackUrl('http://localhost:8000')).toBe(true)
    expect(isLoopbackUrl('http://localhost/soroban/rpc')).toBe(true)
    expect(isLoopbackUrl('http://127.0.0.1:8000')).toBe(true)
    expect(isLoopbackUrl('http://[::1]:8000')).toBe(true)
    expect(isLoopbackUrl('http://test.localhost:8000')).toBe(true)

    expect(isLoopbackUrl('http://soroban-testnet.stellar.org')).toBe(false)
    expect(isLoopbackUrl('http://192.168.1.10:8000')).toBe(false)
    expect(isLoopbackUrl('not-a-url')).toBe(false)
  })

  it('allows plain HTTP for loopback in production builds', () => {
    expect(() => validateRpcEndpoint('http://localhost:8000', 'production', false)).not.toThrow()
    expect(() => validateRpcEndpoint('http://127.0.0.1:8000', 'production', false)).not.toThrow()
    expect(() => validateRpcEndpoint('http://[::1]:8000', 'production', false)).not.toThrow()
  })

  it('allows plain HTTP in non-production builds (development/test)', () => {
    expect(() => validateRpcEndpoint('http://remote-rpc.internal:8000', 'development', false)).not.toThrow()
    expect(() => validateRpcEndpoint('http://remote-rpc.internal:8000', 'test', false)).not.toThrow()
  })

  it('rejects plain HTTP for non-loopback in production builds', () => {
    expect(() =>
      validateRpcEndpoint('http://soroban-testnet.stellar.org', 'production', false)
    ).toThrow(/Insecure HTTP RPC endpoint/)
  })

  it('allows plain HTTP in production when NEXT_PUBLIC_ALLOW_INSECURE_RPC is true', () => {
    expect(() =>
      validateRpcEndpoint('http://vpc-internal.stellar:8000', 'production', true)
    ).not.toThrow()
  })

  it('always accepts HTTPS endpoints', () => {
    expect(() => validateRpcEndpoint('https://soroban-testnet.stellar.org', 'production', false)).not.toThrow()
  })
})
