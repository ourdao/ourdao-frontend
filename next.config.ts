import type { NextConfig } from "next";

/**
 * Build image remote patterns from IPFS gateway configuration.
 * 
 * Note: CSP and other security headers are now generated in src/middleware.ts
 * to support per-request nonce generation for script-src. The buildCsp function
 * has been removed; see middleware.ts for the new nonce-based policy.
 */

function buildImageRemotePatterns() {
  const ipfsGateways = (process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs/")
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);

  const patterns: {
    protocol?: "http" | "https";
    hostname: string;
    port?: string;
    pathname?: string;
  }[] = [];
  const seen = new Set<string>();

  for (const raw of ipfsGateways) {
    try {
      const u = new URL(raw);
      const protocol = (u.protocol.replace(":", "") as "http" | "https") || "https";
      const hostname = u.hostname;
      const port = u.port || undefined;
      let pathname = u.pathname;
      if (!pathname || pathname === "/") {
        pathname = "/**";
      } else {
        pathname = pathname.endsWith("/") ? `${pathname}**` : `${pathname}/**`;
      }

      const key = `${protocol}://${hostname}:${port ?? ""}${pathname}`;
      if (!seen.has(key)) {
        seen.add(key);
        patterns.push({
          protocol,
          hostname,
          ...(port ? { port } : {}),
          pathname,
        });
      }
    } catch {
      // Ignore malformed env values — don't break the build
    }
  }

  return patterns;
}

export { buildImageRemotePatterns };

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {},
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: buildImageRemotePatterns(),
  },
  // Security headers (including CSP) are now set in src/middleware.ts to
  // support per-request nonce generation for script-src. See middleware.ts
  // for the nonce-based CSP policy and rationale.
};

export default nextConfig;

