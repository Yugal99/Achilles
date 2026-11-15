/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server in .next/standalone, used by the Docker image.
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
