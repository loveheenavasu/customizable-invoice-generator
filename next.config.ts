import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // nodemailer uses Node built-ins; keep it out of the server bundle.
  serverExternalPackages: ["nodemailer"],
};

export default nextConfig;
