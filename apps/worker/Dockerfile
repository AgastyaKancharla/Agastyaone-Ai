# Playwright's own image, so Chromium and every system library it needs are
# already present and version-matched. Installing browsers at build time on a
# slim base is where most Playwright deploys break.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# Workspace manifests first, so a dependency-free code change reuses the layer.
COPY package.json package-lock.json ./
COPY apps/worker/package.json        apps/worker/
COPY packages/nap-engine/package.json packages/nap-engine/

RUN npm ci --omit=dev --workspace @agastyaone/worker --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/nap-engine packages/nap-engine
COPY apps/worker        apps/worker

ENV NODE_ENV=production
# No HTTP server: this is a queue consumer, so there is no port to expose and
# nothing to reach it from outside.
CMD ["node", "--experimental-strip-types", "apps/worker/src/index.ts"]
