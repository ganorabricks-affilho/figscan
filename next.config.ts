import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow HMR / assets when the cloud agent port-forwards 43127
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.cursor.sh", "*.cursor.com"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.bricklink.com",
      },
    ],
  },
};

export default nextConfig;
