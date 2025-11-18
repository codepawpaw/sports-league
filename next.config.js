/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static optimization for dynamic routes to prevent caching issues
  experimental: {
    isrMemoryCacheSize: 0, // Disable ISR memory cache
  },
  // Add headers to prevent caching on dynamic routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
