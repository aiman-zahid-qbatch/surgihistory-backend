# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install netcat for database connection check and OpenSSL for Prisma
RUN apk add --no-cache netcat-openbsd openssl openssl-dev libc6-compat

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 5000

# Use entrypoint script (runs migrations then starts server)
ENTRYPOINT ["/entrypoint.sh"]
