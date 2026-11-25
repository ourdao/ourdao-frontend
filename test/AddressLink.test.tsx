// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AddressLink } from '@/components/AddressLink'
import { formatStellarAddress, getAddressUrl, getContractUrl } from '@/lib/stellar'

// #596: AddressLink had no test. It copies the full address to the clipboard
// and shows a copied state, degrades silently when the clipboard write fails,
// and renders the explorer link only when the stellar helper returns a URL.

// The explorer helpers are pure and read the network from env at import time.
// They are wrapped (not replaced) so the real URL logic runs by default; a
// test can force a `null` return to exercise the no-explorer branch.
vi.mock('@/lib/stellar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stellar')>()
  return {
    ...actual,
    getAddressUrl: vi.fn(actual.getAddressUrl),
    getContractUrl: vi.fn(actual.getContractUrl),
  }
})

// Valid canonical G... and C... strkeys (same fixtures as test/stellar.test.ts).
const ACCOUNT = 'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3MQAXRWUDX'
const CONTRACT = 'CA7QYNF7SOWQ3GLR2BGMZEHXR73EWBMGM7OPKJNNOHHEJLBSXMZPQNUD'

const writeText = vi.fn<(text: string) => Promise<void>>()

beforeEach(async () => {
  writeText.mockReset()
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  const stellar = await import('@/lib/stellar')
  vi.mocked(stellar.getAddressUrl).mockImplementation(
    (await vi.importActual<typeof import('@/lib/stellar')>('@/lib/stellar')).getAddressUrl
  )
  vi.mocked(stellar.getContractUrl).mockImplementation(
    (await vi.importActual<typeof import('@/lib/stellar')>('@/lib/stellar')).getContractUrl
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('AddressLink copy button', () => {
  it('writes the full address to the clipboard and shows the copied state', async () => {
    render(<AddressLink address={ACCOUNT} />)

    const copyButton = screen.getByRole('button', { name: 'Copy full address' })
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })
    expect(writeText).toHaveBeenCalledWith(ACCOUNT)

    expect(await screen.findByRole('button', { name: 'Address copied' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Address copied' })).toHaveAttribute('title', 'Copied')
  })

  it('copies the full address even when the visible label is overridden', async () => {
    render(<AddressLink address={ACCOUNT} label="Treasury" />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy full address' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(ACCOUNT)
    })
    expect(screen.getByText('Treasury')).toBeInTheDocument()
  })

  it('does not throw and keeps the default copy state when the clipboard write is rejected', async () => {
    writeText.mockRejectedValue(new Error('Permission denied'))
    render(<AddressLink address={ACCOUNT} />)

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Copy full address' }))).not.toThrow()

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(ACCOUNT)
    })
    // Let the rejected promise settle inside the component's try/catch.
    await act(async () => {})

    expect(screen.getByRole('button', { name: 'Copy full address' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Address copied' })).not.toBeInTheDocument()
    // The full address is still exposed for pointer users via title.
    expect(screen.getByTitle(ACCOUNT)).toBeInTheDocument()
  })

  it('does not throw when navigator.clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    render(<AddressLink address={ACCOUNT} />)

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Copy full address' }))).not.toThrow()
    await act(async () => {})

    expect(screen.getByRole('button', { name: 'Copy full address' })).toBeInTheDocument()
  })
})

describe('AddressLink explorer link', () => {
  it('renders the explorer link with the account URL and rel="noopener noreferrer"', () => {
    render(<AddressLink address={ACCOUNT} />)

    const link = screen.getByRole('link', { name: 'View on block explorer' })
    expect(link).toHaveAttribute('href', getAddressUrl(ACCOUNT))
    expect(link).toHaveAttribute('href', `https://stellar.expert/explorer/testnet/account/${ACCOUNT}`)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('uses the contract URL when kind="contract"', () => {
    render(<AddressLink address={CONTRACT} kind="contract" />)

    const link = screen.getByRole('link', { name: 'View on block explorer' })
    expect(link).toHaveAttribute('href', getContractUrl(CONTRACT))
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does not render the explorer link when the helper returns null', () => {
    vi.mocked(getAddressUrl).mockReturnValue(null)
    render(<AddressLink address={ACCOUNT} />)

    expect(screen.queryByRole('link', { name: 'View on block explorer' })).not.toBeInTheDocument()
    // Copy still works without an explorer.
    expect(screen.getByRole('button', { name: 'Copy full address' })).toBeInTheDocument()
  })

  it('does not render the explorer link when the contract helper returns null', () => {
    vi.mocked(getContractUrl).mockReturnValue(null)
    render(<AddressLink address={CONTRACT} kind="contract" />)

    expect(screen.queryByRole('link', { name: 'View on block explorer' })).not.toBeInTheDocument()
  })
})

describe('AddressLink shortened label', () => {
  it('matches formatStellarAddress with the default 4 characters per side', () => {
    render(<AddressLink address={ACCOUNT} />)

    const expected = formatStellarAddress(ACCOUNT, 4)
    expect(expected).toBe(`${ACCOUNT.slice(0, 4)}…${ACCOUNT.slice(-4)}`)
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('matches formatStellarAddress when chars is overridden', () => {
    render(<AddressLink address={ACCOUNT} chars={6} />)

    expect(screen.getByText(formatStellarAddress(ACCOUNT, 6))).toBeInTheDocument()
  })

  it('shows the label prop instead of the shortened address', () => {
    render(<AddressLink address={ACCOUNT} label="Custom" />)

    expect(screen.getByText('Custom')).toBeInTheDocument()
    expect(screen.queryByText(formatStellarAddress(ACCOUNT, 4))).not.toBeInTheDocument()
  })

  it('renders nothing when address is empty', () => {
    const { container } = render(<AddressLink address="" />)

    expect(container).toBeEmptyDOMElement()
  })
})
