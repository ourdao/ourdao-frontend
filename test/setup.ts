import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// vitest.config.ts sets `globals: false`, so @testing-library/react's
// automatic afterEach-cleanup detection (which looks for a global
// `afterEach`) never fires — every render() across every test file was
// accumulating in the DOM instead of being unmounted between tests. Existing
// tests didn't notice because they render headless hook harnesses (no
// meaningful DOM), but any test that queries rendered output by role/text
// needs this to see one render at a time.
afterEach(() => {
  cleanup()
})
