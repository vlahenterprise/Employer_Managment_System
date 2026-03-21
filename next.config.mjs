/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      "/*": ["./node_modules/@sparticuz/chromium/**/*"]
    }
  }
};

export default nextConfig;
