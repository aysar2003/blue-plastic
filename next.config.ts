import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // exceljs is a Node reader (streams, unzip). Bundling it pulls the browser build.
  // Keep the R2 S3 client external so Vercel Node runtimes get the real package.
  serverExternalPackages: ['exceljs', '@aws-sdk/client-s3', 'puppeteer-core', '@sparticuz/chromium'],
  // Dev: browsers open the app as 127.0.0.1 while `next dev` binds as localhost.
  // Without this, Next blocks /_next chunks and the shell never hydrates — so
  // every Apps chip and menu looks dead.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  experimental: {
    // `forbidden()` renders app/forbidden.tsx instead of the generic error page.
    authInterrupts: true,
    serverActions: {
      // Customer papers / logos stay under ~4 MB. Workspace Documents upload
      // straight to R2 via presigned PUT and never pass through this limit.
      // Cap matches typical serverless body limits and shrinks DoS surface.
      bodySizeLimit: '5mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            // Baseline defense-in-depth. Next needs unsafe-inline for styles;
            // scripts stay self-only where possible.
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "style-src 'self' 'unsafe-inline'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "connect-src 'self' https:",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ]
  },
};

export default nextConfig;
