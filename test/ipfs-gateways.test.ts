import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { computeIPFSCIDs } from '@/lib/ipfs-cid'

// downloadFromIPFS validates the CID before fetching and then checks the
// downloaded bytes against it, so tests need a real CID for the payload served.
const enc = (text: string) => new TextEncoder().encode(text)
const cidOf = async (text: string) => (await computeIPFSCIDs(enc(text))).cidV0

function bytesResponse(bytes: Uint8Array, ok = true, status = ok ? 200 : 500) {
  return { ok, status, arrayBuffer: () => Promise.resolve(bytes.buffer) } as unknown as Response
}

describe('downloadFromIPFS gateway fallback', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_IPFS_GATEWAY', 'https://one.example/ipfs/,https://two.example/ipfs/')
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  async function load() {
    return import('@/lib/ipfs')
  }

  it('returns from the first gateway without touching the second when it succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(bytesResponse(enc('ok')))
    const { downloadFromIPFS } = await load()
    const CID = await cidOf('ok')

    const res = await downloadFromIPFS(CID)

    expect(new TextDecoder().decode(res.content)).toBe('ok')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(`https://one.example/ipfs/${CID}`)
  })

  it('falls back to the next gateway on a non-2xx response', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(bytesResponse(new Uint8Array(), false, 429))
      .mockResolvedValueOnce(bytesResponse(enc('second')))
    const { downloadFromIPFS } = await load()
    const CID = await cidOf('second')

    const res = await downloadFromIPFS(CID)

    expect(new TextDecoder().decode(res.content)).toBe('second')
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe(`https://two.example/ipfs/${CID}`)
  })

  it('falls back on a network error or timeout, passing an abort signal to each request', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
      .mockResolvedValueOnce(bytesResponse(enc('second')))
    const { downloadFromIPFS } = await load()
    const CID = await cidOf('second')

    await downloadFromIPFS(CID)

    for (const [, init] of vi.mocked(fetch).mock.calls) {
      expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal)
    }
  })

  it('throws the last error once every gateway has failed', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(bytesResponse(new Uint8Array(), false, 503))
      .mockResolvedValueOnce(bytesResponse(new Uint8Array(), false, 404))
    const { downloadFromIPFS } = await load()
    const CID = await cidOf('unused')

    await expect(downloadFromIPFS(CID)).rejects.toThrow(/404/)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
