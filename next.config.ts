import type { NextConfig } from "next";

const documentPolicy = [
  "frame-ancestors 'none'", "base-uri 'none'", "object-src 'none'", "form-action 'self'",
  ...(process.env.NODE_ENV === "production" ? [
    "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:", "connect-src 'self'", "worker-src 'self'",
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
        { key: "Content-Security-Policy", value: documentPolicy },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default config;
