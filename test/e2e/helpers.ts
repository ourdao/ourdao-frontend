import { type Page } from '@playwright/test'
import { Keypair, nativeToScVal, SorobanDataBuilder, Transaction, TransactionBuilder, xdr } from '@stellar/stellar-sdk'

export const MOCK_WALLET_ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

export const MOCK_CONTRACT_ID = 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526'

export const MOCK_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'
export const MOCK_NETWORK = 'TESTNET'

export interface MockFreighterOptions {
  address?: string
  network?: string
  networkPassphrase?: string
  autoConnect?: boolean
}

/**
 * Injects a mock Freighter wallet extension into the page environment.
 * Implements the window message protocol used by `@stellar/freighter-api`.
 */
export async function injectFreighter(
  page: Page,
  options: MockFreighterOptions = {}
): Promise<void> {
  const address = options.address ?? MOCK_WALLET_ADDRESS
  const network = options.network ?? MOCK_NETWORK
  const networkPassphrase = options.networkPassphrase ?? MOCK_NETWORK_PASSPHRASE
  const autoConnect = options.autoConnect ?? false

  await page.addInitScript(
    ({ address, network, networkPassphrase, autoConnect }) => {
      const freighterStub = {
        isConnected: () => Promise.resolve(true),
        getFreighterVersion: () => Promise.resolve('3.0.0'),
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

      ;(window as unknown as { freighter?: typeof freighterStub }).freighter = freighterStub
      ;(window as unknown as { freighterApi?: typeof freighterStub }).freighterApi = freighterStub

      let allowed = autoConnect

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
            responsePayload = { isAllowed: allowed }
            break
          case 'SET_ALLOWED_STATUS':
            allowed = true
            responsePayload = { isAllowed: allowed }
            break
          case 'REQUEST_ACCESS':
            allowed = true
            responsePayload = { publicKey: address }
            break
          case 'REQUEST_PUBLIC_KEY':
            responsePayload = { publicKey: address }
            break
          case 'REQUEST_NETWORK':
            responsePayload = { network, networkPassphrase }
            break
          case 'REQUEST_NETWORK_DETAILS':
            responsePayload = {
              networkDetails: {
                network,
                networkPassphrase,
                networkUrl: 'https://horizon-testnet.stellar.org',
                sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
              },
            }
            break
          case 'SUBMIT_TRANSACTION':
            responsePayload = {
              signedTransaction: data.transactionXdr,
              signerAddress: address,
            }
            break
          case 'SUBMIT_BLOB':
            responsePayload = {
              signedBlob: 'bW9jay1zaWduYXR1cmU=',
              signerAddress: address,
            }
            break
          default:
            responsePayload = {}
        }

        window.postMessage(
          {
            source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
            messageId,
            ...responsePayload,
          },
          window.location.origin
        )
      })
    },
    { address, network, networkPassphrase, autoConnect }
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
  let isMember = options.isMember ?? true
  let hasVoted = false
  const walletAddress = options.freighter?.address ?? MOCK_WALLET_ADDRESS
  const mockAccountId = Keypair.fromPublicKey(walletAddress).xdrPublicKey()
  const mockAccount = new xdr.AccountEntry({
    accountId: mockAccountId,
    balance: xdr.Int64.fromString('1000000000'),
    seqNum: xdr.Int64.fromString('1000'),
    numSubEntries: 0,
    inflationDest: null,
    flags: 0,
    homeDomain: '',
    thresholds: Buffer.alloc(4),
    signers: [],
    ext: xdr.AccountEntryExt.v0(),
  })
  const accountKey = xdr.LedgerKey.account(new xdr.LedgerKeyAccount({ accountId: mockAccountId }))
  const transactionData = new SorobanDataBuilder().build().toXdr('base64')
  let submitted: { envelope: string; method: string } | undefined

  function contractMethod(envelope: string) {
    const tx = TransactionBuilder.fromXDR(envelope, MOCK_NETWORK_PASSPHRASE)
    const op = tx instanceof Transaction ? tx.operations[0] : undefined
    if (op?.type !== 'invokeHostFunction' || op.func.type !== 'hostFunctionTypeInvokeContract') {
      throw new Error('Expected a Soroban contract call')
    }
    return op.func.invokeContract.functionName.toString()
  }

  function simulationResult(method: string) {
    switch (method) {
      case 'get_token':
        return MOCK_CONTRACT_ID
      case 'name':
        return 'Testnet XLM'
      case 'symbol':
        return 'XLM'
      case 'decimals':
        return 7
      case 'balance':
      case 'get_treasury_balance':
        return BigInt(10_000_000_000)
      case 'get_total_members':
        return 10
      case 'get_active_members':
        return 8
      case 'get_consensus_threshold':
        return 5_000
      case 'get_loan_policy':
        return { membership_contribution: BigInt(10_000_000), max_loan_to_treasury_ratio: 5_000 }
      case 'get_member':
        return isMember ? { status: 'ActiveMember', has_active_loan: options.hasActiveLoan ?? false } : null
      case 'is_member':
      case 'is_eligible_for_loan':
        return isMember
      case 'is_admin':
      case 'is_paused':
        return false
      case 'has_voted':
        return hasVoted
      case 'get_pending_yield':
      case 'calculate_exit_share':
      case 'get_stake':
      case 'get_voting_weight':
        return BigInt(0)
      case 'get_loan_proposal':
        return {
          id: 1,
          borrower: walletAddress,
          amount: BigInt(100_000_000),
          interest_rate: 500,
          status: 'Pending',
          phase: 'Voting',
          created_at: 1000,
          editing_period_end: 2000,
          voting_period: 604800,
        }
      case 'calculate_loan_terms':
        return { duration: 604800, interest_rate: 500, total_repayment: BigInt(1_050_000_000) }
      case 'register_member':
      case 'request_loan':
      case 'vote_on_loan_proposal':
        return null
      default:
        throw new Error(`No mock Soroban result for ${method}`)
    }
  }

  // Intercept backend API requests
  await page.route('**/api/**', async (route) => {
    const url = route.request().url()

    if (url.includes('/api/stream')) {
      return route.fulfill({ status: 204 })
    }

    if (url.includes('/api/stats')) {
      return route.fulfill({
        json: {
          totalMembers: 10,
          activeMembers: 8,
          totalLoanProposals: 1,
          totalLoans: 0,
          activeLoans: 0,
          defaultedLoans: 0,
          totalTreasuryProposals: 0,
          totalStaked: '5000000000',
          lastIndexedLedger: 12345,
          secondsSinceUpdate: 2,
          indexerStale: false,
          totalDefaultedValue: '0',
          interestCollected: '0',
          principalLent: '0',
          principalRepaid: '0',
          valueDefaulted: '0',
        },
      })
    }

    if (url.includes('/api/loans') || url.includes('/api/notifications') || url.includes('/api/events')) {
      return route.fulfill({ json: [] })
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

    const { id, method, params } = route.request().postDataJSON() as {
      id: string | number
      method: string
      params?: { transaction?: string }
    }
    const respond = (result: unknown) => route.fulfill({ json: { jsonrpc: '2.0', id, result } })

    switch (method) {
      case 'getHealth':
        return respond({ status: 'healthy' })
      case 'getLatestLedger':
        return respond({ id: '1', sequence: 1000, protocolVersion: 20 })
      case 'getLedgerEntries':
        return respond({
          latestLedger: 1000,
          entries: [{
            key: accountKey.toXdr('base64'),
            xdr: xdr.LedgerEntryData.account(mockAccount).toXdr('base64'),
            lastModifiedLedgerSeq: 1000,
          }],
        })
      case 'simulateTransaction': {
        const result = simulationResult(contractMethod(params!.transaction!))
        return respond({
          latestLedger: 1000,
          minResourceFee: '100',
          results: [{ auth: [], xdr: nativeToScVal(result).toXdr('base64') }],
          transactionData,
        })
      }
      case 'sendTransaction': {
        const envelope = params!.transaction!
        submitted = { envelope, method: contractMethod(envelope) }
        return respond({
          status: 'PENDING',
          hash: '1234567890abcdef'.repeat(4),
          latestLedger: 1000,
          latestLedgerCloseTime: 123456789,
        })
      }
      case 'getTransaction': {
        if (!submitted) throw new Error('Cannot confirm a transaction before submission')
        if (submitted.method === 'vote_on_loan_proposal') hasVoted = true
        if (submitted.method === 'register_member') isMember = true
        const result = new xdr.TransactionResult({
          feeCharged: xdr.Int64.fromString('100'),
          result: xdr.TransactionResultResult.txSuccess([]),
          ext: xdr.TransactionResultExt.v0(),
        })
        return respond({
          status: 'SUCCESS',
          latestLedger: 1001,
          ledger: 1000,
          createdAt: 1234567890,
          envelopeXdr: submitted.envelope,
          resultXdr: result.toXdr('base64'),
          resultMetaXdr: xdr.TransactionMeta.operations([]).toXdr('base64'),
        })
      }
      default:
        throw new Error(`No mock RPC response for ${method}`)
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
export async function setupE2ETest(page: Page, options: SetupMockOptions = {}): Promise<void> {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    window.localStorage.setItem('theme', 'light')
  })
  await injectFreighter(page, options.freighter)
  await setupMockRpcAndBackend(page, options)
}
