// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  reportError,
  setErrorReportingOptIn,
  setErrorReportingTransport,
  isErrorReportingOptedIn,
  type ErrorReportPayload,
} from '@/lib/error-reporting'

describe('error-reporting', () => {
  beforeEach(() => {
    localStorage.clear()
    setErrorReportingTransport(null)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    localStorage.clear()
    setErrorReportingTransport(null)
    vi.restoreAllMocks()
  })

  it('defaults to opted out and sends nothing', () => {
    expect(isErrorReportingOptedIn()).toBe(false)
    reportError(new Error('something bad'))
    expect(console.error).not.toHaveBeenCalled()
  })

  it('respects opt-in and scrubs Stellar addresses', () => {
    setErrorReportingOptIn(true)
    expect(isErrorReportingOptedIn()).toBe(true)

    const address = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFDAGORAc526G22TYOxa2'.toUpperCase()
    reportError(new Error(`Failed for ${address}`), { user: address })

    expect(console.error).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(console.error).mock.calls[0]
    expect(callArgs[0]).toBe('[error-report]')
    const payload = callArgs[1] as ErrorReportPayload
    expect(payload.message).not.toContain(address)
    expect(payload.message).toContain('[redacted-address]')
    expect(payload.context?.user).toBe('[redacted-address]')
  })

  it('dispatches to pluggable transport when registered', () => {
    setErrorReportingOptIn(true)
    const transport = vi.fn()
    setErrorReportingTransport(transport)

    reportError(new Error('transport test'), { action: 'vote' })

    expect(transport).toHaveBeenCalledTimes(1)
    expect(console.error).not.toHaveBeenCalled()
    const payload = transport.mock.calls[0][0] as ErrorReportPayload
    expect(payload.message).toBe('transport test')
    expect(payload.context?.action).toBe('vote')
  })
})
