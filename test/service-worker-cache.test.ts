/**
 * Unit tests for public/sw.js (#479).
 *
 * The worker is a plain script with no build step, so it is loaded into a VM
 * context with a minimal `self`/`caches`/`fetch` shim and driven through its
 * real event listeners. That keeps the assertions about *what may be cached*
 * next to the code that decides it, rather than in a Playwright run.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const SOURCE = readFileSync(resolve(import.meta.dirname, '../public/sw.js'), 'utf-8')
const ORIGIN = 'https://app.example'

type RequestLike = string | { url: string }
type Listener = (event: unknown) => void

interface FetchInit {
  mode?: string
  method?: string
}

interface Worker {
  listeners: Map<string, Listener[]>
}

const keyOf = (request: RequestLike): string =>
  typeof request === 'string' ? new URL(request, ORIGIN).href : request.url

function createEnv() {
  const stores = new Map<string, Map<string, Response>>()
  const fetchMock = vi.fn(
    async (request: { url: string }) =>
      new Response(`network:${request.url}`, { status: 200 })
  )

  const makeCache = (store: Map<string, Response>) => ({
    async put(request: RequestLike, response: Response) {
      store.set(keyOf(request), response)
    },
    async match(request: RequestLike) {
      return store.get(keyOf(request))
    },
    async delete(request: RequestLike) {
      return store.delete(keyOf(request))
    },
    async keys() {
      return [...store.keys()].map((url) => ({ url }))
    },
    async addAll(paths: string[]) {
      for (const path of paths) {
        store.set(keyOf(path), new Response(`precached:${path}`, { status: 200 }))
      }
    },
  })

  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map())
      return makeCache(stores.get(name)!)
    },
    async keys() {
      return [...stores.keys()]
    },
    async delete(name: string) {
      return stores.delete(name)
    },
    async match(request: RequestLike) {
      for (const store of stores.values()) {
        const hit = store.get(keyOf(request))
        if (hit) return hit
      }
      return undefined
    },
  }

  function run(version = 'build-1'): Worker {
    const listeners = new Map<string, Listener[]>()
    const self = {
      location: { href: `${ORIGIN}/sw.js?v=${version}`, origin: ORIGIN },
      addEventListener(type: string, fn: Listener) {
        const existing = listeners.get(type) ?? []
        existing.push(fn)
        listeners.set(type, existing)
      },
      skipWaiting() {},
      clients: { claim() {} },
    }
    const context = vm.createContext({
      self,
      caches,
      fetch: fetchMock,
      URL,
      Response,
      console,
    })
    vm.runInContext(SOURCE, context)
    return { listeners }
  }

  /** Let fire-and-forget cache writes settle. */
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

  return {
    run,
    flush,
    fetchMock,
    cacheNames: () => [...stores.keys()],
    totalCached: () =>
      [...stores.values()].reduce((total, store) => total + store.size, 0),
  }
}

function dispatch(worker: Worker, type: string, event: unknown) {
  for (const fn of worker.listeners.get(type) ?? []) fn(event)
}

function lifecycle(worker: Worker, type: 'install' | 'activate') {
  const waits: Promise<unknown>[] = []
  dispatch(worker, type, { waitUntil: (promise: Promise<unknown>) => waits.push(promise) })
  return Promise.all(waits)
}

/** Returns the `respondWith` promise, or undefined when the worker opts out. */
function fetchEvent(worker: Worker, url: string, init: FetchInit = {}) {
  const request = { url, method: init.method ?? 'GET', mode: init.mode ?? 'no-cors' }
  let response: Promise<Response> | undefined
  dispatch(worker, 'fetch', {
    request,
    respondWith(promise: Promise<Response>) {
      response = promise
    },
  })
  return response
}

describe('public/sw.js cache scope (#479)', () => {
  it('never intercepts cross-origin requests', async () => {
    const env = createEnv()
    const worker = env.run()

    const response = fetchEvent(worker, 'https://gateway.pinata.cloud/ipfs/bafybeigdyrzt')
    await env.flush()

    expect(response).toBeUndefined()
    expect(env.fetchMock).not.toHaveBeenCalled()
    expect(env.totalCached()).toBe(0)
  })

  it('never caches member-scoped API responses', async () => {
    const env = createEnv()
    const worker = env.run()

    expect(fetchEvent(worker, `${ORIGIN}/api/members/GALICE`)).toBeUndefined()
    expect(fetchEvent(worker, `${ORIGIN}/api/notifications?address=GALICE`)).toBeUndefined()
    await env.flush()

    // The browser performs these requests; the worker neither answers nor
    // stores them, so nothing about the connected member survives a reload.
    expect(env.fetchMock).not.toHaveBeenCalled()
    expect(env.totalCached()).toBe(0)
  })

  it('does not cache RSC payloads, which are unique per navigation', async () => {
    const env = createEnv()
    const worker = env.run()

    expect(fetchEvent(worker, `${ORIGIN}/loans?_rsc=1a2b3c`, { mode: 'cors' })).toBeUndefined()
    expect(fetchEvent(worker, `${ORIGIN}/loans?_rsc=9z8y7x`, { mode: 'cors' })).toBeUndefined()
    await env.flush()

    expect(env.totalCached()).toBe(0)
  })

  it('caches build assets and answers the next request from the cache', async () => {
    const env = createEnv()
    const worker = env.run()
    const chunk = `${ORIGIN}/_next/static/chunks/app-loans-abc123.js`

    const first = await fetchEvent(worker, chunk)
    expect(await first!.text()).toBe(`network:${chunk}`)
    await env.flush()

    const second = await fetchEvent(worker, chunk)
    expect(await second!.text()).toBe(`network:${chunk}`)
    expect(env.fetchMock).toHaveBeenCalledTimes(1)
    expect(env.totalCached()).toBe(1)
  })

  it('serves the precached shell for an offline navigation', async () => {
    const env = createEnv()
    const worker = env.run()
    await lifecycle(worker, 'install')

    env.fetchMock.mockRejectedValueOnce(new Error('offline'))
    const response = await fetchEvent(worker, `${ORIGIN}/loans`, { mode: 'navigate' })

    expect(await response!.text()).toBe('precached:/')
  })

  it('names the cache after the build and deletes older build caches on activate', async () => {
    const env = createEnv()

    const v1 = env.run('build-1')
    await lifecycle(v1, 'install')
    expect(env.cacheNames()).toEqual(['ourdao-build-1'])

    const v2 = env.run('build-2')
    await lifecycle(v2, 'install')
    // Both exist until the new worker activates, exactly as in a real deploy.
    expect(env.cacheNames()).toEqual(['ourdao-build-1', 'ourdao-build-2'])

    await lifecycle(v2, 'activate')
    expect(env.cacheNames()).toEqual(['ourdao-build-2'])
  })

  it('keeps the static cache bounded across many deploys worth of chunks', async () => {
    const env = createEnv()
    const worker = env.run()

    for (let i = 0; i < 150; i += 1) {
      await fetchEvent(worker, `${ORIGIN}/_next/static/chunks/chunk-${i}.js`)
      await env.flush()
    }

    expect(env.totalCached()).toBeLessThan(150)
    expect(env.totalCached()).toBeLessThanOrEqual(80)
  })
})
