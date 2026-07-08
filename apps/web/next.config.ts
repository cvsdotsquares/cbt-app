import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@cbt/shared'],
  eslint: { ignoreDuringBuilds: true },
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
