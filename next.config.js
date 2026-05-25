/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Prevent monorepo detection
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;