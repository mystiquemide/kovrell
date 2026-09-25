import type { NextConfig } from "next";

/**
 * When APP_ORIGIN is set (the Vercel landing deployment), app and call routes redirect to the
 * origin that runs the call server. Unset, this app serves everything itself.
 */
const APP_ORIGIN = process.env.APP_ORIGIN?.replace(/\/$/, "");
const APP_ROUTES = ["requests", "evidence", "vendors", "integrate", "calls", "v", "api", "ws"];

const nextConfig: NextConfig = {
  async redirects() {
    if (!APP_ORIGIN) return [];
    return APP_ROUTES.flatMap((r) => [
      { source: `/${r}`, destination: `${APP_ORIGIN}/${r}`, permanent: false },
      { source: `/${r}/:path*`, destination: `${APP_ORIGIN}/${r}/:path*`, permanent: false },
    ]);
  },
};

export default nextConfig;
