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
      // Small attachments (customer papers, logos). Workspace Documents
      // upload straight to R2 via presigned PUT (up to 100 MB) and never
      // pass through this limit — Vercel caps function bodies at ~4.5 MB.
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
