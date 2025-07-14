# Use Node.js LTS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Create directory for SQLite database
RUN mkdir -p /app/data

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm@9.12.0

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Expose port (if needed)
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV DB_PATH=/app/data/bot.db

# Create volume for SQLite database
VOLUME ["/app/data"]

# Start the application
CMD ["pnpm", "run", "start"]