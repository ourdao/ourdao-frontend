import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import nextConfig from "../next.config";
import { buildCspWithNonce, proxy } from "@/proxy";

/**
 * Issue #239 — the CSP builder and the seven security headers were completely
 * untested. The CSP is env-driven (RPC / backend / IPFS origins plus ws/wss
 * variants) and deliberately swallows malformed values; the headers themselves
 * could be dropped silently by a refactor.
 *
 * These assertions target src/proxy.ts, the only place security headers are
 * emitted at runtime. next.config.ts must not send a second, competing policy.
 *
 * Covers: defaults, custom origins, malformed-input isolation, every emitted
 * header, and connect-src inclusion. Out of scope: changing the policy.
 */
const NONCE = "dGVzdC1ub25jZS0xMjM0NQ==";

function directive(csp: string, name: string): string | undefined {
  return csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `));
}

describe("proxy CSP and security headers (#239)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a default policy containing the default RPC and backend origins", () => {
    // Unset so the builder falls back to its compiled-in defaults.
    vi.stubEnv("NEXT_PUBLIC_SOROBAN_RPC_URL", "");
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "");
    vi.stubEnv("NEXT_PUBLIC_IPFS_GATEWAY", "");

    const csp = buildCspWithNonce(NONCE);

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("https://soroban-testnet.stellar.org");
    expect(csp).toContain("http://localhost:4000");
    // ws/wss variants for http/https origins.
    expect(csp).toContain("wss://soroban-testnet.stellar.org");
    expect(csp).toContain("ws://localhost:4000");
    expect(csp).toContain("ws://localhost:*");
    expect(csp).toContain("wss://localhost:*");
  });

  it("includes custom backend, RPC, and gateway origins in connect-src", () => {
    vi.stubEnv("NEXT_PUBLIC_SOROBAN_RPC_URL", "https://rpc.custom.dev");
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "https://api.custom.dev");
    vi.stubEnv("NEXT_PUBLIC_IPFS_GATEWAY", "https://ipfs.custom.dev/ipfs/");

    const connectSrc = directive(buildCspWithNonce(NONCE), "connect-src");
    expect(connectSrc).toBeDefined();
    expect(connectSrc).toContain("https://rpc.custom.dev");
    expect(connectSrc).toContain("https://api.custom.dev");
    expect(connectSrc).toContain("https://ipfs.custom.dev");
    expect(connectSrc).toContain("wss://rpc.custom.dev");
    expect(connectSrc).toContain("wss://api.custom.dev");
  });

  it("omits only the malformed origin and still returns a valid policy", () => {
    vi.stubEnv("NEXT_PUBLIC_SOROBAN_RPC_URL", "https://rpc.valid.dev");
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", ":::not a url:::");
    vi.stubEnv("NEXT_PUBLIC_IPFS_GATEWAY", "https://ipfs.valid.dev/ipfs/");

    const csp = buildCspWithNonce(NONCE);

    expect(csp).toContain("https://rpc.valid.dev");
    expect(csp).toContain("https://ipfs.valid.dev");
    expect(csp).not.toContain(":::not a url:::");
    // Still a valid policy with the structural directives intact.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("ignores a malformed IPFS gateway while keeping RPC and backend", () => {
    vi.stubEnv("NEXT_PUBLIC_SOROBAN_RPC_URL", "https://soroban-testnet.stellar.org");
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "http://localhost:4000");
    vi.stubEnv("NEXT_PUBLIC_IPFS_GATEWAY", "not-a-url, https://good-gateway.dev/ipfs/");

    const csp = buildCspWithNonce(NONCE);

    expect(csp).toContain("https://good-gateway.dev");
    expect(csp).toContain("https://soroban-testnet.stellar.org");
    expect(csp).toContain("http://localhost:4000");
    expect(csp).not.toContain("not-a-url");
  });

  it("emits every security header with its expected value", () => {
    const response = proxy(new NextRequest(new URL("http://localhost:3000/")));
    const h = response.headers;

    const csp = h.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    const nonce = csp!.match(/'nonce-([A-Za-z0-9+/=]+)'/)?.[1];
    expect(nonce).toBeDefined();
    expect(csp).toBe(buildCspWithNonce(nonce!));

    expect(h.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains; preload");
    expect(h.get("X-Content-Type-Options")).toBe("nosniff");
    expect(h.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(h.get("X-Frame-Options")).toBe("DENY");
    expect(h.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()"
    );
    expect(h.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });

  it("keeps the CSP structural directives intact", () => {
    vi.stubEnv("NEXT_PUBLIC_SOROBAN_RPC_URL", "");
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "");
    vi.stubEnv("NEXT_PUBLIC_IPFS_GATEWAY", "");

    const csp = buildCspWithNonce(NONCE);
    for (const d of [
      "default-src 'self'",
      `script-src 'nonce-${NONCE}' 'strict-dynamic'`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "worker-src 'self' blob:",
      "media-src",
    ]) {
      expect(csp).toContain(d);
    }
    // Regression guard for the old permissive policy.
    expect(directive(csp, "script-src")).not.toContain("'unsafe-inline'");
    expect(directive(csp, "img-src")).not.toMatch(/(^|\s)https:(\s|$)/);
  });

  it("next.config sends no headers, so the proxy policy is the only one", () => {
    expect(nextConfig.headers).toBeUndefined();
  });
});
