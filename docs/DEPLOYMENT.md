# Deployment Guide

## Deployment Target

OurDAO Frontend is a **Next.js 16 application** that requires a **Node.js server runtime** for full functionality. It cannot run as a static export because:

- `src/app/api/documents/route.ts` is a server-side API route that handles document uploads to Pinata
- Security headers in `next.config.ts` are emitted by the Next.js server
- `PINATA_JWT` is a server-only secret that must live in the server environment

## Runtime Requirements

- **Node.js**: >= 18.0.0 (LTS recommended)
- **npm**: >= 9.0.0
- **Platform**: Any platform supporting Node.js (Vercel, Railway, Docker, self-hosted)

## Environment Variables

### Build-time Variables (NEXT_PUBLIC_*)

These are inlined at build time and cannot be changed at runtime:

| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_CONTRACT_ID` | Deployed OurDAO contract ID | _(empty)_ |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Network passphrase | testnet |
| `NEXT_PUBLIC_IPFS_GATEWAY` | IPFS gateway URL(s) | Pinata gateway |
| `NEXT_PUBLIC_BACKEND_URL` | OurDAO backend URL | `http://localhost:4000` |
| `NEXT_PUBLIC_SITE_URL` | Public site origin | `http://localhost:3000` |
| `NEXT_PUBLIC_FEATURE_FLAGS` | Comma-separated names of the risky changes to enable in this build | _(empty → all flags off)_ |

### Runtime Variables (Server-only)

These are read at runtime and never exposed to the client:

| Variable | Purpose | Required |
|----------|---------|----------|
| `PINATA_JWT` | Pinata credential for document pinning | Yes (for uploads) |

## Security Headers

The following security headers are configured in `next.config.ts` and applied by the Next.js server:

- `Content-Security-Policy` (enforced)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `frame-ancestors 'none'` (CSP)
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `poweredByHeader: false`

**Note**: If deploying to a static host (not recommended), these headers must be configured separately at the hosting layer.

## Deployment Options

### Option 1: Docker (Recommended for self-hosted)

```bash
# Build the Docker image
docker build -t ourdao-frontend .

# Run the container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_CONTRACT_ID=YOUR_CONTRACT_ID \
  -e NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-mainnet.stellar.org \
  -e NEXT_PUBLIC_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015" \
  -e PINATA_JWT=YOUR_PINATA_JWT \
  -e NEXT_PUBLIC_BACKEND_URL=https://your-backend.example.com \
  -e NEXT_PUBLIC_SITE_URL=https://your-domain.example.com \
  ourdao-frontend
```

### Option 2: Vercel

1. Connect your GitHub repository to Vercel
2. Set environment variables in the Vercel dashboard
3. Deploy automatically on push to `main`

### Option 3: Self-hosted (Node.js)

```bash
npm install
npm run build
npm start
```

## Build and Run Recipe

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your values

# 3. Build for production
npm run build

# 4. Start the server
npm start
```

The app will be available at `http://localhost:3000` by default.

## Build-time vs Runtime Variables

| Type | Examples | When Set | Changeable at Runtime |
|------|----------|----------|----------------------|
| Build-time | `NEXT_PUBLIC_*` | During `npm run build` | No |
| Runtime | `PINATA_JWT` | When server starts | Yes |

**Important**: Changing `NEXT_PUBLIC_*` values requires a full rebuild and redeployment.

## Mainnet deployment checklist

The defaults in `.env.example` target public **testnet**. Going to production on
**mainnet** means changing network config, pairing with the backend's CORS, and
verifying everything matches before you announce it. Work top to bottom.

### 1. Switch the network (testnet → mainnet)

All three values change together — a mainnet contract id with a testnet passphrase
signs against the wrong network. Because these are `NEXT_PUBLIC_*`, each change
requires a **full rebuild** (see "Build-time vs Runtime Variables" above).

| Variable | Testnet (default) | Mainnet |
|----------|-------------------|---------|
| `NEXT_PUBLIC_CONTRACT_ID` | _(empty / testnet `C…`)_ | the **mainnet** contract id (`C…`) |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | `Public Global Stellar Network ; September 2015` |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` | your mainnet RPC (see below) |

### 2. Choose a mainnet RPC provider

The public `https://soroban-rpc.mainnet.stellar.gateway.fm` / SDF endpoints are
rate-limited and **not meant for production traffic**. For mainnet use a dedicated
provider (e.g. Validation Cloud, Blockdaemon, QuickNode, or self-hosted Soroban RPC):

- Pick a provider with an SLA and request quota that covers your expected read volume —
  the app polls contract state, so budget for sustained reads, not just writes.
- Must be served over **HTTPS**. Plain HTTP is rejected in production builds unless it
  is loopback or `NEXT_PUBLIC_ALLOW_INSECURE_RPC=true` is set (see
  `validateRpcEndpoint` in `src/lib/stellar.ts`) — do **not** set that in production.
- If you hit rate limits you will see failing simulations/reads; scale the plan or add
  a caching RPC proxy rather than lowering the app's poll frequency blindly.

### 3. Pair CORS with the backend

The frontend calls the OurDAO backend (`NEXT_PUBLIC_BACKEND_URL`) for loan history,
aggregates, notifications and the event feed. The backend must allow the frontend's
origin:

- Set the backend's `CORS_ORIGIN` to the **exact** frontend origin you deploy to —
  the same value as `NEXT_PUBLIC_SITE_URL` (scheme + host, no trailing slash),
  e.g. `https://app.ourdao.io`.
- A mismatch shows up as browser CORS errors and backend-derived data silently
  degrading to empty (the UI fails soft — see `src/lib/backend.ts`), so verify this
  explicitly rather than trusting the page to error.

### 4. Confirm security headers

The CSP, HSTS, `X-Frame-Options`, etc. are emitted by the Next.js server (see
"Security Headers" above and `next.config.ts`). If you deploy behind a proxy or CDN,
confirm it does not strip or override them, and that HSTS is served only over HTTPS.

### 5. Match versions across frontend, contract and backend

A contract redeploy that renames a variant or reorders arguments silently breaks the
frontend. Before going live, confirm the three move together:

- The **frontend** build points at the intended **contract id** for this release.
- The **backend** indexes that same contract id / network.
- If the contract surface changed, follow
  [CONTRACT-REDPLOYMENT.md](CONTRACT-REDPLOYMENT.md) for what to update here and in
  what order.

### 6. Smoke test after deploy

With the production build live, verify end to end:

- [ ] The header network badge reads **Mainnet** and no wrong-network banner shows.
- [ ] A read path renders real data (e.g. proposals/loans load, not the "not
      configured" state).
- [ ] Connect Freighter on mainnet and confirm no wrong-network warning.
- [ ] One low-risk write (e.g. a vote or a small action) simulates and submits, and
      the success toast links to the transaction on the explorer.
- [ ] Backend-derived data (loan history, notifications) is present — if empty, re-check
      `CORS_ORIGIN` (step 3) and `NEXT_PUBLIC_BACKEND_URL`.
- [ ] Response headers include the CSP/HSTS from step 4 (`curl -sI https://your-domain`).

### 7. Know your rollback path before you need it

If the deploy is wrong, see [ROLLBACK.md](ROLLBACK.md) for turning a feature flag off,
reverting to the last good build, or rolling forward — and what **cannot** be rolled
back (on-chain state).

## After a deploy

- **Something is wrong and you need to undo it:** see
  [ROLLBACK.md](ROLLBACK.md) — the flag-off, redeploy-previous-build, and
  roll-forward lanes, and what can't be rolled back at all.
- **The contract was redeployed:** see
  [CONTRACT-REDPLOYMENT.md](CONTRACT-REDPLOYMENT.md) — what has to change in
  this repo, and in what order.
- **You shipped something risky behind a flag:** see
  [FEATURE_FLAGS.md](FEATURE_FLAGS.md) for how flags work and how to remove one.
