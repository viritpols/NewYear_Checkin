/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable logging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  // Network configuration
  // Server will listen on all network interfaces (0.0.0.0)
  // This allows access via IP address from other devices on the network
  // Output standalone for Docker
  output: 'standalone',
  // ซ่อน header ที่บอก tech stack
  poweredByHeader: false,
  // Security headers พื้นฐาน (กัน clickjacking / MIME-sniff / ลด referrer leak)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig

