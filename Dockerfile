FROM node:20-slim

# Install Python and build tools for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ sqlite3 libsqlite3-dev && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm v9 (v10 has postinstall issues with better-sqlite3) and node-gyp
RUN npm install -g pnpm@9 node-gyp

# Install dependencies
RUN pnpm install --frozen-lockfile

# Manual build approach that fixes the missing bindings issue
RUN cd node_modules/.pnpm/better-sqlite3*/node_modules/better-sqlite3 && pnpm run build-release

# Copy source code
COPY . .

# Build the app
RUN pnpm run build

# Expose port
EXPOSE 3000

# Start the app
CMD ["pnpm", "start"] 