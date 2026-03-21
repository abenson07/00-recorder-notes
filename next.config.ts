import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/projects",
        destination: "/legacy",
        permanent: true,
      },
      {
        source: "/projects/:projectId",
        destination: "/legacy/projects/:projectId",
        permanent: true,
      },
      {
        source: "/projects/:projectId/recordings/:recordingId",
        destination: "/legacy/projects/:projectId/recordings/:recordingId",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
