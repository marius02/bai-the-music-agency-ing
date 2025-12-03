/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['cdn1.suno.ai', 'cdn2.suno.ai'],
  },
}

module.exports = nextConfig
