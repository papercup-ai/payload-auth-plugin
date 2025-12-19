import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Security headers to mitigate XSS and other attacks
  // These headers provide defense-in-depth for the OAuth session cookie
  // which cannot be HttpOnly due to architectural constraints
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            // Content Security Policy: Restricts what resources can be loaded
            // Helps prevent XSS attacks by controlling script sources
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'", // Only load resources from same origin
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Allow scripts (needed for Next.js)
              "style-src 'self' 'unsafe-inline'", // Allow inline styles (needed for Payload CMS)
              "img-src 'self' data: https:", // Allow images from self, data URIs, and HTTPS
              "font-src 'self' data:", // Allow fonts from self and data URIs
              "connect-src 'self' https:", // Allow HTTPS API calls (for Auth0, Sentry, external APIs, etc.)
              "worker-src 'self' blob:", // Allow Web Workers from same origin and blob URLs (needed for Sentry)
            ].join('; '),
          },
          {
            // Prevents MIME type sniffing
            // Stops browsers from interpreting files as different MIME type
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            // Prevents clickjacking attacks
            // Stops the site from being embedded in iframes
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            // Enables browser XSS protection (legacy but still useful)
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            // Enforces HTTPS connections
            // Tells browsers to only connect via HTTPS for next 1 year
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ]
  },
}

export default withPayload(nextConfig)
