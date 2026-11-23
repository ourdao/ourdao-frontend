# Compatibility Expectations

This document defines the compatibility expectations between OurDAO Frontend and its dependencies.

## Backend API Compatibility

**Target:** `ourdao-backend`

### What may change without notice

- Response fields not consumed by the frontend (extra fields are tolerated)
- Internal backend implementation details
- Non-breaking HTTP status code changes

### What requires coordination

- Removal or renaming of fields the frontend consumes
- Changes to field types (e.g., string to number)
- Breaking changes to endpoint paths or request/response structures
- Changes to authentication/authorization mechanisms

### How the frontend finds out

- CI integration tests that validate response shapes
- Version pinning in `package.json` or environment configuration

### Frontend behavior on unrecognized responses

- Extra fields in responses are silently ignored
- Missing required fields result in graceful degradation (showing default/empty states rather than crashes)
- Malformed responses trigger user-facing error messages with retry options

## Contract ABI Compatibility

**Target:** `ourdao-contracts`

### What may change without notice

- Internal contract implementation details
- Gas optimization changes that don't affect the ABI

### What requires coordination

- Changes to contract function signatures
- Changes to event definitions
- Deployment of new contract versions (new deployment = new contract ID)

### Coupling notes

Contract changes are fundamentally different from backend changes:

- A contract change means a new deployment with a new contract ID
- The frontend must be updated to reference the new contract ID
- ABI drift is currently tracked in issue #143

### How the frontend finds out
- Contract ABI is embedded in the frontend codebase (`src/lib/generated/dao-bindings.ts`)
- New deployments require explicit frontend updates (`npm run gen:contract`)
- CI verifies `src/lib/generated/dao-bindings.ts` against the pinned ref in `contract/interface.json` (`_last_verified`) on PRs/pushes, and runs a non-blocking daily schedule against `ourdao-contracts` `main` to surface upstream drift (#541)

**Current target decision (#541):** The frontend currently targets `ourdao-contracts @ 16e4222` (the pinned commit in `contract/interface.json` and `CHANGELOG.md`). Regenerating the bindings against `ourdao-contracts` `main` is deferred to a dedicated contract-upgrade PR.

## Version Tracking

Each frontend release records which backend and contract versions it targets: see the `Backend:` / `Contracts:` lines under each entry in [CHANGELOG.md](../CHANGELOG.md), which supersede the table below.

| Frontend Version | Backend Version | Contract ID | Notes                    |
| ---------------- | --------------- | ----------- | ------------------------ |
| _Current_        | _Unversioned_   | _Pinned_    | No formal versioning yet |

## Testing Strategy

- **Backend drift:** Integration tests validate response shapes in CI
- **Contract drift:** Planned CI job to detect ABI changes (#143)
- **Runtime errors:** Frontend gracefully handles unexpected responses

## Wallet and browser compatibility

Freighter is optional. The connected wallet may be Freighter, xBull, Albedo, LOBSTR, or compatible hardware wallets. Safari users can select a compatible web-based wallet (for example Albedo). Signed transactions remain wallet-controlled; compatibility and message signing are wallet dependent.
