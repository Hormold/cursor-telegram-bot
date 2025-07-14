FROM node:20-slim

# Install Python and build tools for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ sqlite3 libsqlite3-dev && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Rebuild better-sqlite3 to ensure it works
RUN pnpm rebuild better-sqlite3

# Copy source code
COPY . .

# Build the app
RUN pnpm run build

# Expose port
EXPOSE 3000

# Start the app
CMD ["pnpm", "start"] 