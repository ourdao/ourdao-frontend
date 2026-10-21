// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'

describe('ServiceWorkerRegistration (#479)', () => {
  const register = vi.fn().mockResolvedValue({ scope: '/' })

  beforeEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_GIT_SHA
    delete process.env.NEXT_PUBLIC_APP_VERSION
  })

  it('versions the worker URL with the build id so a deploy gets a fresh cache', async () => {
    process.env.NEXT_PUBLIC_GIT_SHA = 'abc123def456'

    render(<ServiceWorkerRegistration />)

    await vi.waitFor(() => expect(register).toHaveBeenCalledWith('/sw.js?v=abc123def456'))
  })

  it('falls back to the app version when the build has no commit sha', async () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '0.1.0'

    render(<ServiceWorkerRegistration />)

    await vi.waitFor(() => expect(register).toHaveBeenCalledWith('/sw.js?v=0.1.0'))
  })
})
