import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: "." },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "search.pstatic.net" },
      { protocol: "https", hostname: "phinf.pstatic.net" },
      { protocol: "http", hostname: "imgnews.pstatic.net" },
      { protocol: "https", hostname: "ssl.pstatic.net" },
    ],
  },
};

export default nextConfig;
