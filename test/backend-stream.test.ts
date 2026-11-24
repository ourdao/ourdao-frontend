// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openEventStream } from '@/lib/backend'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  readonly listeners = new Map<string, Array<(e: Event) => void>>()
  onmessage: unknown = null
  onopen: (() => void) | null = null
  closed = false
  constructor(readonly url: string) {
    FakeEventSource.instances.push(this)
  }
  addEventListener(type: string, fn: (e: Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn])
  }
  close() {
    this.closed = true
  }
  /** Deliver a named server frame; `body` is serialised like the wire format. */
  emit(type: string, body: unknown) {
    const data = typeof body === 'string' ? body : JSON.stringify(body)
    for (const fn of this.listeners.get(type) ?? []) fn(new MessageEvent(type, { data }))
  }
}

const CONFIGURED_URL = 'http://localhost:4000'

describe('openEventStream', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', CONFIGURED_URL)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('registers handlers for the four named events and not onmessage', () => {
    openEventStream({ onEvent: vi.fn() })
    const source = FakeEventSource.instances[0]!
    expect(source.url).toBe(`${CONFIGURED_URL}/api/stream`)
    expect([...source.listeners.keys()].sort()).toEqual(['error', 'heartbeat', 'notification', 'resync'])
    expect(source.onmessage).toBeNull()
  })

  it('sends the channel subset as ?channels=', () => {
    openEventStream({ onEvent: vi.fn(), channels: ['members_changed', 'loans_changed'] })
    expect(FakeEventSource.instances[0]!.url).toBe(
      `${CONFIGURED_URL}/api/stream?channels=members_changed%2Cloans_changed`
    )
  })

  it('forwards a valid notification and a resync (with payload.missed)', () => {
    const onEvent = vi.fn()
    openEventStream({ onEvent })
    const source = FakeEventSource.instances[0]!
    const notification = {
      type: 'notification',
      channel: 'loans_changed',
      payload: { ledger: 7 },
      timestamp: 1,
    }
    const resync = { type: 'resync', payload: { missed: true, lastKnownLedger: 9 }, timestamp: 2 }
    source.emit('notification', notification)
    source.emit('resync', resync)
    expect(onEvent).toHaveBeenNthCalledWith(1, notification)
    expect(onEvent).toHaveBeenNthCalledWith(2, resync)
    expect(onEvent.mock.calls[1]![0].payload.missed).toBe(true)
  })

  it('drops and logs malformed JSON and wrong-shape events', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onEvent = vi.fn()
    openEventStream({ onEvent })
    const source = FakeEventSource.instances[0]!
    source.emit('notification', '{not json')
    source.emit('notification', { type: 'bogus', timestamp: 'nope' })
    source.emit('resync', { type: 'resync', payload: { missed: 'yes' }, timestamp: 3 })
    source.emit('heartbeat', { type: 'notification', timestamp: 4 })
    expect(onEvent).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(4)
  })

  it('reports open and transport error through onStatus', () => {
    const onStatus = vi.fn()
    openEventStream({ onEvent: vi.fn(), onStatus })
    const source = FakeEventSource.instances[0]!
    source.onopen?.()
    source.listeners.get('error')!.forEach((fn) => fn(new Event('error')))
    expect(onStatus.mock.calls).toEqual([['open'], ['error']])
  })

  it('close() closes the underlying EventSource', () => {
    const close = openEventStream({ onEvent: vi.fn() })
    close()
    expect(FakeEventSource.instances[0]!.closed).toBe(true)
  })

  it('is a no-op returning a no-op close when the backend is not configured', () => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', '')
    const onEvent = vi.fn()
    const close = openEventStream({ onEvent })
    expect(FakeEventSource.instances).toHaveLength(0)
    expect(() => close()).not.toThrow()
    expect(onEvent).not.toHaveBeenCalled()
  })
})
