import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["firebase-admin"],
  // A lockfile in the home directory would otherwise be picked as the workspace root.
  turbopack: { root: __dirname },
};

export default nextConfig;
