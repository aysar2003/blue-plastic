import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // exceljs is a Node reader (streams, unzip). Bundling it pulls the browser build.
  serverExternalPackages: ['exceljs'],
  // Uploads are runtime-only on disk — never ship them inside serverless traces.
  outputFileTracingExcludes: {
    '*': ['./uploads/**'],
  },
  experimental: {
    // `forbidden()` renders app/forbidden.tsx instead of the generic error page.
    authInterrupts: true,
    serverActions: {
      // A customer photo plus the debt-agreement papers.
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
