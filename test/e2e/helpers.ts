import { type Page } from '@playwright/test'

export const MOCK_WALLET_ADDRESS =
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

export const MOCK_CONTRACT_ID =
  'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526'

export const MOCK_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'
export const MOCK_NETWORK = 'TESTNET'

export interface MockFreighterOptions {
  address?: string
  network?: string
  networkPassphrase?: string
  version?: string
  autoConnect?: boolean
}

/**
 * Injects a mock Freighter wallet extension into the page environment.
 * Stubs both `window.freighter` / `window.freighterApi` and the window
 * message protocol used by `@stellar/freighter-api`.
 */
export async function injectFreighter(
  page: Page,
  options: MockFreighterOptions = {}
): Promise<void> {
  const address = options.address ?? MOCK_WALLET_ADDRESS
  const network = options.network ?? MOCK_NETWORK
  const networkPassphrase = options.networkPassphrase ?? MOCK_NETWORK_PASSPHRASE
  const version = options.version ?? '5.1.0'
  const autoConnect = options.autoConnect ?? false

  await page.addInitScript(
    ({ address, network, networkPassphrase, version, autoConnect }) => {
      const freighterStub = {
        isConnected: () => Promise.resolve(true),
        getFreighterVersion: () => Promise.resolve(version),
        isAllowed: () => Promise.resolve(autoConnect),
        setAllowed: () => Promise.resolve(true),
        requestAccess: () => Promise.resolve({ address }),
        getAddress: () => Promise.resolve({ address }),
        getNetwork: () => Promise.resolve({ network, networkPassphrase }),
        getNetworkDetails: () =>
          Promise.resolve({
            network,
            networkPassphrase,
            networkUrl: 'https://horizon-testnet.stellar.org',
            sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
          }),
        signTransaction: (xdr: string) => Promise.resolve(xdr),
        signMessage: () => Promise.resolve('bW9jay1zaWduYXR1cmU='),
      }

      ;(window as unknown as { freighter?: typeof freighterStub }).freighter =
        freighterStub
      ;(window as unknown as { freighterApi?: typeof freighterStub }).freighterApi =
        freighterStub

      // Message-based communication used by @stellar/freighter-api
      window.addEventListener('message', (event) => {
        if (event.source !== window) return
        const data = event.data
        if (!data || data.source !== 'FREIGHTER_EXTERNAL_MSG_REQUEST') return

        const messageId = data.messageId
        const type = data.type
        let responsePayload: Record<string, unknown> = {}

        switch (type) {
          case 'REQUEST_CONNECTION_STATUS':
            responsePayload = { isConnected: true }
            break
          case 'REQUEST_ALLOWED_STATUS':
            responsePayload = { isAllowed: autoConnect }
            break
          case 'SET_ALLOWED_STATUS':
            responsePayload = { isAllowed: true }
            break
          case 'REQUEST_ACCESS':
          case 'REQUEST_PUBLIC_KEY':
            responsePayload = { publicKey: address }
            break
          case 'REQUEST_NETWORK':
            responsePayload = { network, networkPassphrase }
            break
          case 'REQUEST_NETWORK_DETAILS':
            responsePayload = {
              network,
              networkPassphrase,
              networkUrl: 'https://horizon-testnet.stellar.org',
              sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
            }
            break
          case 'SUBMIT_TRANSACTION':
            responsePayload = {
              signedTransaction: data.transactionXdr || 'AAAA...mockSignedTx...',
              signerAddress: address,
            }
            break
          case 'SUBMIT_BLOB':
          case 'SUBMIT_MESSAGE':
            responsePayload = {
              signedMessage: 'bW9jay1zaWduYXR1cmU=',
              signerAddress: address,
            }
            break
          default:
            responsePayload = {}
        }

        window.postMessage(
          {
            source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
            messagedId: messageId,
            messageId,
            ...responsePayload,
          },
          window.location.origin
        )
      })
    },
    { address, network, networkPassphrase, version, autoConnect }
  )
}

export interface SetupMockOptions {
  freighter?: MockFreighterOptions
  isMember?: boolean
  hasActiveLoan?: boolean
}

/**
 * Sets up route interception for both Soroban RPC and backend API endpoints.
 */
export async function setupMockRpcAndBackend(
  page: Page,
  options: SetupMockOptions = {}
): Promise<void> {
  const isMember = options.isMember ?? true

  // Intercept backend API requests
  await page.route('**/api/**', async (route) => {
    const url = route.request().url()

    if (url.includes('/api/ready')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ready: true, indexerStale: false }),
      })
    }

    if (url.includes('/api/stats')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalMembers: 10,
          activeMembers: 8,
          totalLoanProposals: 2,
          totalLoans: 1,
          activeLoans: 1,
          defaultedLoans: 0,
          totalTreasuryProposals: 1,
          totalStaked: '5000000000',
          lastIndexedLedger: 12345,
          secondsSinceUpdate: 2,
          indexerStale: false,
          totalDefaultedValue: '0',
          membershipFee: '10000000',
        }),
      })
    }

    if (url.includes('/api/notifications')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    }

    if (url.includes('/api/events')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    }

    if (url.includes('/api/auth/challenge')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          challenge: 'mock-challenge-token',
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        }),
      })
    }

    if (url.includes('/api/auth/verify')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, address: MOCK_WALLET_ADDRESS }),
      })
    }

    if (url.includes('/api/loans')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            borrower: MOCK_WALLET_ADDRESS,
            amount: '100000000',
            interestRate: 500,
            termMonths: 12,
            status: 'Active',
            createdAt: new Date().toISOString(),
          },
        ]),
      })
    }

    if (url.includes('/api/proposals')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            kind: 'Loan',
            proposer: MOCK_WALLET_ADDRESS,
            amount: '100000000',
            status: 'Voting',
            votesFor: '500000000',
            votesAgainst: '0',
            createdAt: new Date().toISOString(),
          },
        ]),
      })
    }

    // Default API fallback
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    })
  })

  // Intercept Soroban RPC JSON-RPC calls
  await page.route('**/*soroban*/**', async (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue()
    }

    let body: { id?: string | number; method?: string; params?: unknown } = {}
    try {
      body = JSON.parse(route.request().postData() || '{}')
    } catch {
      /* ignore */
    }

    const id = body.id ?? 1
    const method = body.method

    switch (method) {
      case 'getHealth':
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id, result: { status: 'healthy' } }),
        })

      case 'getLatestLedger':
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: { id: '1', sequence: 1000, protocolVersion: 20 },
          }),
        })

      case 'getLedgerEntries':
        // Returns AccountEntry for getAccount call
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              latestLedger: 1000,
              entries: [
                {
                  key: 'AAAAAAAAAABCPn0F8uyvv+wZKyFaPxvpau242OcCVKvjQT4CB95Wsg==',
                  xdr: 'AAAAAAAAAABCPn0F8uyvv+wZKyFaPxvpau242OcCVKvjQT4CB95WsgAAAAJUC+QAAAAAAAAAAGQAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAA',
                  lastModifiedLedgerSeq: 1000,
                },
              ],
            },
          }),
        })

      case 'simulateTransaction': {
        // Return boolean true or appropriate ScVal depending on context
        const xdrValue = isMember ? 'AAAAAAAAAAE=' : 'AAAAAAAAAAA='
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              latestLedger: 1000,
              minResourceFee: '100',
              cost: { cpuInsns: '100', memBytes: '100' },
              results: [{ auth: [], xdr: xdrValue }],
              transactionData: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            },
          }),
        })
      }

      case 'sendTransaction':
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              status: 'PENDING',
              hash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              latestLedger: 1000,
              latestLedgerCloseTime: '123456789',
            },
          }),
        })

      case 'getTransaction':
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              status: 'SUCCESS',
              latestLedger: 1001,
              ledger: 1000,
              createdAt: 1234567890,
              returnValue: 'AAAAAAAAAAE=',
            },
          }),
        })

      default:
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id, result: {} }),
        })
    }
  })
}

/**
 * Prepares the page for E2E testing:
 * - Reduced motion enabled to prevent animation flakiness
 * - Theme set in localStorage
 * - Injected Freighter mock
 * - Injected RPC and backend route mocks
 */
export async function setupE2ETest(
  page: Page,
  options: SetupMockOptions = {}
): Promise<void> {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    window.localStorage.setItem('theme', 'light')
  })
  await injectFreighter(page, options.freighter)
  await setupMockRpcAndBackend(page, options)
}
