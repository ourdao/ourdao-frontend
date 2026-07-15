# OurDAO Frontend

A [Next.js](https://nextjs.org) web app for the **OurDAO** member-owned lending DAO on **Stellar Soroban**.

This frontend was ported from an EVM stack (wagmi / RainbowKit / ethers) to Stellar:

- **Wallet:** [Freighter](https://www.freighter.app/) via `@stellar/freighter-api`
- **Chain access:** `@stellar/stellar-sdk` (Soroban RPC — simulate for reads, prepare/sign/submit for writes)
- **Contract:** the [`ourdao-contracts`](https://github.com/ourdao/ourdao-contracts) Soroban DAO

## Getting started

```bash
npm install
cp .env.example .env.local   # then edit values (all optional; testnet defaults)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Install the **Freighter** browser extension to connect a wallet.

## Configuration

All config is env-driven with public-testnet defaults (see `.env.example`):

| Variable | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_CONTRACT_ID` | Deployed OurDAO contract id (`C…`) | _(empty → read-only "not configured")_ |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Network passphrase | testnet |
| `NEXT_PUBLIC_IPFS_GATEWAY` | Gateway for document content hashes | Pinata |

Without a `NEXT_PUBLIC_CONTRACT_ID` the UI runs and renders, but on-chain reads/writes are disabled until you point it at a deployed contract.

## Where the Stellar integration lives

| File | Role |
|---|---|
| `src/lib/stellar.ts` | Network config, RPC client, explorer URLs |
| `src/lib/wallet.tsx` | Freighter connect/disconnect/sign context (`useWallet`) |
| `src/lib/dao-client.ts` | Soroban read/invoke + typed wrappers for the contract's methods |
| `src/components/ConnectButton.tsx` | Freighter-backed drop-in for the old RainbowKit button |
| `src/hooks/useDAO.ts` | React-Query hooks the pages consume (unchanged surface) |

## Scripts

```bash
npm run dev     # dev server (http://localhost:3000)
npm run build   # production build
npm start       # serve the production build
npm run lint    # eslint
```
