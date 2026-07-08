import type { NextConfig } from 'next';
import path from 'path';
import { loadEnvConfig } from '@next/env';

// Share JWT_ACCESS_SECRET (and API_PROXY_URL) from the API package in monorepo dev.
loadEnvConfig(path.join(__dirname, '..', 'api'));

const nextConfig: NextConfig = {
  transpilePackages: ['@cbt/shared'],
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  outputFileTracingRoot: path.join(__dirname, '../..'),
  experimental: {
    // Material uploads (full NCERT books) can be ~100 MB; default proxy buffer is 10 MB.
    proxyClientMaxBodySize: '100mb',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
    ],
  },
};

export default nextConfig;
