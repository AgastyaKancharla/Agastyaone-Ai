# Use official Microsoft Playwright image with all browser binaries & dependencies pre-installed
FROM mcr.microsoft.com/playwright:v1.42.0-jammy

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install npm dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Start our own 100% self-hosted Cloud Worker
CMD ["npm", "run", "worker"]
