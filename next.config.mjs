/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com"
      }
    ]
  },
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development"
    }
  }
};

export default nextConfig;
