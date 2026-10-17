import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { render } from '@testing-library/react'
import { ConnectButton } from '@/components/ConnectButton'

const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
let mockAddress: string | undefined
let mockIsConnected = false
let mockConnecting = false
let mockNetworkMismatch = false

vi.mock('@/lib/wallet', () => ({
  useWallet: () => ({
    address: mockAddress,
    isConnected: mockIsConnected,
    connecting: mockConnecting,
    networkMismatch: mockNetworkMismatch,
    connect: mockConnect,
    disconnect: mockDisconnect,
    signXDR: vi.fn(),
  }),
}))

describe('ConnectButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAddress = undefined
    mockIsConnected = false
    mockConnecting = false
    mockNetworkMismatch = false
  })
  afterEach(() => vi.clearAllMocks())

  it('disconnected: shows "Connect Wallet" and calls connect() on click', () => {
    render(<ConnectButton />)
    const button = screen.getByRole('button', { name: 'Connect Wallet' })
    fireEvent.click(button)
    expect(mockConnect).toHaveBeenCalledTimes(1)
    expect(mockDisconnect).not.toHaveBeenCalled()
  })

  it('connected: shows the shortened address, not "Connect Wallet", and calls disconnect() on click', () => {
    mockAddress = 'GALICEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
    mockIsConnected = true
    render(<ConnectButton />)

    expect(screen.queryByText('Connect Wallet')).not.toBeInTheDocument()
    const button = screen.getByRole('button', { name: /GALI/ })
    fireEvent.click(button)
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('connecting: shows "Connecting…" and disables the button so it cannot be double-clicked', () => {
    mockConnecting = true
    render(<ConnectButton />)

    const button = screen.getByRole('button', { name: /Connecting/ })
    expect(button).toBeDisabled()
  })

  it('Custom: reports the connected account and an authenticated status', () => {
    mockAddress = 'GALICEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
    mockIsConnected = true
    render(
      <ConnectButton.Custom>
        {(props) => (
          <span data-testid="custom">
            {props.authenticationStatus}|{props.account?.displayName}|{String(props.chain.unsupported)}
          </span>
        )}
      </ConnectButton.Custom>
    )

    expect(screen.getByTestId('custom')).toHaveTextContent('authenticated')
    expect(screen.getByTestId('custom')).toHaveTextContent('GALI')
  })

  it('Custom: reports an unauthenticated status with no account when disconnected', () => {
    render(
      <ConnectButton.Custom>
        {(props) => (
          <span data-testid="custom">
            {props.authenticationStatus}|{props.account ? 'has-account' : 'no-account'}
          </span>
        )}
      </ConnectButton.Custom>
    )

    expect(screen.getByTestId('custom')).toHaveTextContent('unauthenticated|no-account')
  })

  it('Custom: surfaces a network mismatch as an unsupported chain', () => {
    mockNetworkMismatch = true
    render(
      <ConnectButton.Custom>
        {(props) => <span data-testid="custom">{String(props.chain.unsupported)}</span>}
      </ConnectButton.Custom>
    )

    expect(screen.getByTestId('custom')).toHaveTextContent('true')
  })

  it('Custom: wires the connect and disconnect actions through to the wallet', () => {
    render(
      <ConnectButton.Custom>
        {(props) => (
          <span data-testid="custom">
            <button type="button" onClick={props.openConnectModal}>
              connect
            </button>
            <button type="button" onClick={props.openAccountModal}>
              disconnect
            </button>
          </span>
        )}
      </ConnectButton.Custom>
    )

    fireEvent.click(screen.getByRole('button', { name: 'connect' }))
    fireEvent.click(screen.getByRole('button', { name: 'disconnect' }))
    expect(mockConnect).toHaveBeenCalledTimes(1)
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })
})
