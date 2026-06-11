import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ── OBLIGATOIRE pour Docker (image minimale) ──────────────────────
  output: 'standalone',

  // ── Proxy API vers le backend (évite CORS en prod) ────────────────
  // En Docker, le backend s'appelle "backend" sur le réseau interne
  // En dev local, il tourne sur localhost:9000
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://backend:8000'}/api/:path*`,
      },
    ]
  },
}

export default nextConfig