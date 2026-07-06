/** @type {import('next').NextConfig} */
const apiProxy =
  process.env.API_PROXY_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxy}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${apiProxy}/health`,
      },
    ];
  },
};

module.exports = nextConfig;
