import type { NextConfig } from "next";

const documentPolicy = [
  "frame-ancestors 'none'", "base-uri 'none'", "object-src 'none'", "form-action 'self'",
  ...(process.env.NODE_ENV === "production" ? [
    "style-src 'self'", "frame-src 'none'",
    "img-src 'self' data:", "connect-src 'self'", "worker-src 'self'", "font-src 'self'", "media-src 'none'", "manifest-src 'self'",
  ] : []),
].join("; ");

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      ],
    }, {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: documentPolicy },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "X-DNS-Prefetch-Control", value: "off" },
        ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default config;
