FROM oven/bun:1 AS base

WORKDIR /app

# Install dependencies
COPY package.json ./
COPY bun.lock* ./
RUN bun install

# Copy source code
COPY . .

# Expose port
EXPOSE 4000

# Create entrypoint script to handle migrations
RUN echo '#!/bin/sh\nbun run src/db/migrate.ts || true\nbun run src/index.ts' > entrypoint.sh && chmod +x entrypoint.sh

# Start server
CMD ["./entrypoint.sh"]

