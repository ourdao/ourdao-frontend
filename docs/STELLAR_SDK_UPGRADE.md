# Stellar SDK 16 to 17 Upgrade Plan & Verification Runbook

## Overview
This document tracks the upgrade of `@stellar/stellar-sdk` from `16.0.1` to `^17.1.0` (#383).
Staying on recent SDK releases ensures timely support for Soroban protocol upgrades, XDR schema alignment, and security patches.

## Key Changes in Stellar SDK 17.x

1. **Soroban RPC Client (`rpc.Server`)**
   - Maintained full interface compatibility for `simulateTransaction`, `sendTransaction`, `getTransaction`, and `getEvents`.
   - Enhanced typing for simulation responses and restoration footprint hints.
2. **Transaction Building (`TransactionBuilder`, `Account`, `FeeBumpTransaction`)**
   - Protocol-level Soroban transaction structures and fee estimation remain consistent.
   - Resource fee modeling and auth entry encoding follow Soroban protocol standards.
3. **ScVal Conversions (`scValToNative`, `nativeToScVal`)**
   - Type conversions for symbols, integers (i128 / u64), addresses, and contract maps continue to be supported without schema drift.

## Affected Components

- `src/lib/stellar.ts`: RPC server instantiation, loopback security validations, network passphrase helpers.
- `src/lib/dao-client.ts`: Contract invocations, simulation diagnostics, transaction assembly, ScVal parsing.
- `src/lib/wallet.tsx`: Wallet provider integration and network detection via `@stellar/freighter-api`.

## Testnet Smoke Test Verification Runbook

Follow these manual and automated steps on Stellar Testnet (`https://soroban-testnet.stellar.org`):

### 1. Member Registration
1. Connect a fresh testnet wallet account with Freighter.
2. Ensure account has funded testnet XLM via Friendbot.
3. Submit the membership registration transaction.
4. Verify transaction confirmation toast, explorer link, and that `isMember` flips to `true` without needing a hard reload.

### 2. Proposal Voting
1. Navigate to the Governance tab (`/governance`).
2. Select an active loan or treasury proposal.
3. Cast a vote ("Yes" or "No").
4. Verify that vote submission completes, confirmation is received, and member's vote status updates in the UI.

### 3. Loan Repayment
1. Create and disburse a test loan or use an existing active loan.
2. Submit a partial or full loan repayment action.
3. Verify that the on-chain balance updates, outstanding loan amount decreases, and activity feed indexes the event.

## Rollback Plan
If regressions occur on testnet:
1. Revert the dependency pin in `package.json` back to `"@stellar/stellar-sdk": "^16.0.1"`.
2. Run `npm install` to regenerate `package-lock.json`.
3. Check in the lockfile update and deploy a patch release.
