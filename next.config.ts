import type { NextConfig } from "next";
import { version } from "./package.json";

/**
 * Build image remote patterns from IPFS gateway configuration.
 *
 * Note: CSP and other security headers are generated in src/proxy.ts to
 * support per-request nonce generation for script-src. Do not add a
 * headers() block here — it would send a second, competing policy.
 */
function buildImageRemotePatterns() {
  const ipfsGateways = (process.env.NEXT_PUBLIC_IPFS_GATEWAY || "")
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
  output: "standalone",
  poweredByHeader: false,
  turbopack: {},
  productionBrowserSourceMaps: process.env.ANALYZE_BUNDLE === "1",
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_GIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "",
  },
  pageExtensions:
    process.env.NODE_ENV === "production"
      ? ["tsx", "ts", "jsx", "js"]
      : ["dev.tsx", "tsx", "ts", "jsx", "js"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: buildImageRemotePatterns(),
  },
};

export default nextConfig;
