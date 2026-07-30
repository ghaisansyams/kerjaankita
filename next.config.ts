import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin the file-tracing root to this project so Next doesn't get confused by
// unrelated lockfiles higher up the filesystem (and so Vercel traces correctly).
const projectRoot = dirname(fileURLToPath(import.meta.url));

// Baseline hardening headers. A strict CSP is left to the deployment checklist
// (it needs per-environment tuning for Supabase + Next's inline runtime).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  poweredByHeader: false,
  // Heavy Node parsers used only in server actions (document import). Keep them
  // external so they load from node_modules at runtime instead of being bundled.
  serverExternalPackages: ["mammoth", "unpdf", "@anthropic-ai/sdk", "@napi-rs/canvas"],
  images: {
    // Public avatar/branding buckets are served from the Supabase project host.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
