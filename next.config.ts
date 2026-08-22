import type { NextConfig } from "next";

// `NEXT_EXPORT_DIR` redirects the static export to another directory. It exists
// so a test can build the site a second time with a different configuration —
// specifically, with the question service configured — and assert the result
// without overwriting the `out/` artifact the rest of the suite reads. Unset in
// every normal and CI build, where the export lands in `out/` as before.
const exportDir = process.env.NEXT_EXPORT_DIR?.trim();

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  ...(exportDir ? { distDir: exportDir } : {}),
};

export default nextConfig;
