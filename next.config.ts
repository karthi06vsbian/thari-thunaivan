import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server keeps its files apart from "next build", so building while it runs cannot break it.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  serverExternalPackages: ["firebase-admin"],
  experimental: {
    // Keep a visited page for a short while so moving between sections feels instant.
    // Saving anything refreshes the page, so stale data is never shown after a change.
    staleTimes: { dynamic: 30, static: 180 },
  },
  turbopack: { root: __dirname },
};

export default nextConfig;
