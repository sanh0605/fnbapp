process.env.TZ = 'Asia/Ho_Chi_Minh';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Production builds must fail when TypeScript detects an error.
    ignoreBuildErrors: false,
  },
  // BR-UI-007 (owner 2026-10-09): Tổng kết ngày is gone; a saved shortcut opens
  // Doanh số on Hôm nay instead of a missing page.
  async redirects() {
    return [
      { source: "/admin/reports/daily", destination: "/admin/reports/sales?range=TODAY", permanent: false },
    ];
  },
}

module.exports = nextConfig
