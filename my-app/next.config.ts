import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // Keep one driver module instance across Route Handlers and development reloads.
  serverExternalPackages: ["mssql"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default nextConfig;
