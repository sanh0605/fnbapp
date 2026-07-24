process.env.TZ = 'Asia/Ho_Chi_Minh';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Production builds must fail when TypeScript detects an error.
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig
