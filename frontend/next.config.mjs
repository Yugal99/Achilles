const isDev = process.env.NODE_ENV === 'development'

// Tailored to what the app actually loads: everything is same-origin (next/font self-hosts the fonts,
// the browser only calls /api/achilles/*). No nonces: pages are statically prerendered, and nonces
// would force dynamic rendering. 'unsafe-inline' is needed for Next's inline bootstrap scripts and for
// the print-to-PDF report window (lib/export.ts), which inherits this policy.
// No upgrade-insecure-requests: there are no http:// subresources, and it would break plain-HTTP
// local runs. HSTS is set by nginx (deploy/), only after HTTPS is verified.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server in .next/standalone, used by the Docker image.
  output: 'standalone',
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
