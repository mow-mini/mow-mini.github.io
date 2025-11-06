const packageJson = require("./package.json");

const isGithubPages = process.env.GITHUB_PAGES === "true";
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isUserOrOrgPagesRepo =
  repoName && repoName.toLowerCase().endsWith(".github.io");
const derivedBasePath =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  (isGithubPages && repoName && !isUserOrOrgPagesRepo ? `/${repoName}` : "");

const appVersion =
  process.env.NEXT_PUBLIC_APP_VERSION ?? packageJson.version ?? "0.0.0";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    scrollRestoration: true,
  },
  output: "export",
  images: {
    unoptimized: true,
  },
  basePath: derivedBasePath || undefined,
  assetPrefix: derivedBasePath ? `${derivedBasePath}/` : undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: derivedBasePath,
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

module.exports = nextConfig;
