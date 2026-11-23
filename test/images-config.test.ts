import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildImageRemotePatterns } from '../next.config'

describe('next.config image remotePatterns for IPFS gateways (#245)', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('allows no remote image gateways when the env is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_IPFS_GATEWAY', undefined)

    expect(buildImageRemotePatterns()).toEqual([])
  })

  it('derives remote patterns from comma-separated NEXT_PUBLIC_IPFS_GATEWAY', () => {
    vi.stubEnv(
      'NEXT_PUBLIC_IPFS_GATEWAY',
      'https://ipfs.io/ipfs/, http://localhost:8080/ipfs/, https://custom-gateway.xyz:9000/content'
    )
    const patterns = buildImageRemotePatterns()

    expect(patterns).toHaveLength(3)
    expect(patterns[0]).toEqual({
      protocol: 'https',
      hostname: 'ipfs.io',
      pathname: '/ipfs/**',
    })
    expect(patterns[1]).toEqual({
      protocol: 'http',
      hostname: 'localhost',
      port: '8080',
      pathname: '/ipfs/**',
    })
    expect(patterns[2]).toEqual({
      protocol: 'https',
      hostname: 'custom-gateway.xyz',
      port: '9000',
      pathname: '/content/**',
    })
  })

  it('handles root path gateways by permitting /** wildcard', () => {
    vi.stubEnv('NEXT_PUBLIC_IPFS_GATEWAY', 'https://w3s.link')
    const patterns = buildImageRemotePatterns()

    expect(patterns).toEqual([
      {
        protocol: 'https',
        hostname: 'w3s.link',
        pathname: '/**',
      },
    ])
  })

  it('deduplicates identical gateway URLs in env', () => {
    vi.stubEnv(
      'NEXT_PUBLIC_IPFS_GATEWAY',
      'https://gateway.pinata.cloud/ipfs/, https://gateway.pinata.cloud/ipfs/'
    )
    const patterns = buildImageRemotePatterns()

    expect(patterns).toHaveLength(1)
    expect(patterns[0].hostname).toBe('gateway.pinata.cloud')
  })

  it('passes configured gateway patterns and modern image formats to Next.js', async () => {
    vi.stubEnv('NEXT_PUBLIC_IPFS_GATEWAY', 'https://gateway.pinata.cloud/ipfs/')
    vi.resetModules()
    const { default: nextConfig } = await import('../next.config')

    expect(nextConfig.images).toEqual({
      formats: ['image/avif', 'image/webp'],
      remotePatterns: [{ protocol: 'https', hostname: 'gateway.pinata.cloud', pathname: '/ipfs/**' }],
    })
  })
})
