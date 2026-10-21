# Browser Support Matrix

## Supported Browsers

OurDAO Frontend supports the following browsers, based on the intersection of:
- Next.js 16's default browser support
- wallet provider availability
- Required APIs (`crypto.subtle` for document encryption)

| Browser | Minimum Version | Notes |
|---------|-----------------|-------|
| Chrome | 100+ | Full support |
| Firefox | 100+ | Full support |
| Safari | 16+ | Full support (secure context required for document encryption) |
| Edge | 100+ | Full support (Chromium-based) |

## Wallet Compatibility

Freighter is one supported wallet, not a requirement. Chrome, Firefox, and Edge can use the Freighter extension (v2.0.0 or later). The wallet picker also supports xBull, Albedo, LOBSTR and compatible hardware wallets. Safari users can use compatible web wallets such as Albedo without installing Freighter. Wallet compatibility depends on the wallet's own browser support and signing capabilities.

## Secure Context Requirement

Document encryption uses `crypto.subtle` for AES-GCM, which requires a **secure context** (HTTPS or localhost). Features affected:

- **Document uploads**: AES-GCM encryption before pinning to IPFS
- **Document downloads**: Decryption of encrypted documents

**Without HTTPS**, the app runs but document encryption silently fails. The upload form shows a warning when `crypto.subtle` is unavailable.

## Required APIs

| API | Purpose | Fallback |
|-----|---------|----------|
| `crypto.subtle` | Document encryption (AES-GCM) | Warning shown; uploads disabled |
| `useSyncExternalStore` | Clock and screen size hooks | React 18+ polyfill |
| `navigator.clipboard` | Copy wallet address | Manual copy fallback |
| `window.freighterApi` | Wallet connection | Choose another compatible wallet or install Freighter |

## Browserslist Configuration

The following `browserslist` configuration is recommended for `package.json`:

```json
{
  "browserslist": [
    "chrome >= 100",
    "firefox >= 100",
    "safari >= 16",
    "edge >= 100"
  ]
}
```

## Unsupported Browsers

The following browsers are explicitly not supported:
- Internet Explorer (all versions)
- Opera Mini
- Samsung Internet < 18
- Any browser without `crypto.subtle` support

## Testing

Browser compatibility is verified through:
- CI browser stack testing (planned)
- Manual testing on supported browsers before releases
- `crypto.subtle` availability detection in `src/lib/ipfs.ts`
