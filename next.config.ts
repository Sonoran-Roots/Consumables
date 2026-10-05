import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions default to a 1 MB request body. Inventory Audit uploads
    // can be a whole tracker tab exported as CSV (about 2.5 MB), so allow more —
    // but stay under Vercel's 4.5 MB serverless request limit.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
