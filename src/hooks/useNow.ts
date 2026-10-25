'use client'

import { useSyncExternalStore } from 'react'

// useSyncExternalStore requires getSnapshot to return a value that's stable
// between calls until the store actually changes — calling it repeatedly
// without an intervening notify must return the *same* reference/value.
// Date.now() breaks that contract (it returns something new on essentially
// every call), which made React see a "changed" snapshot on every render
// and re-render forever chasing it (React error #185, Maximum update depth
// exceeded). Caching the value and only refreshing it on the interval tick
// (right before notifying subscribers) fixes that.
let cachedNow = Date.now()

function subscribe(callback: () => void) {
  // Refresh cachedNow = Date.now() before starting the interval so a
  // subscription made after a long gap gets the current time immediately,
  // not a stale value that could be hours old (#483).
  cachedNow = Date.now()
  // Notify once immediately so the component gets the fresh value on mount.
  callback()
  
  const id = setInterval(() => {
    cachedNow = Date.now()
    callback()
  }, 30_000)
  return () => clearInterval(id)
}

// Exported for a direct contract test — see test/useNow.test.tsx. Rendering
// through React to provoke error #185 isn't reliable outside a real browser.
export function getSnapshot() {
  return cachedNow
}

function getServerSnapshot() {
  return null
}

/**
 * Wall-clock time in ms, ticking every 30s. Reading Date.now() directly
 * during render is impure (react-hooks/purity) — useSyncExternalStore is
 * the sanctioned place to read live external state instead. Returns null
 * on the server/first paint; consumers should treat that as "unknown yet".
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
