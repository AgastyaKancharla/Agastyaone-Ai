/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source rather than a build step, so Next
  // compiles them alongside the app.
  transpilePackages: ['@agastyaone/places-client'],
};

export default nextConfig;
