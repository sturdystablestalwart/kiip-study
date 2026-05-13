# SHA-pinned base for reproducible/secure builds.
# To refresh: `docker pull node:20-alpine && docker inspect --format='{{index .RepoDigests 0}}' node:20-alpine`
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Create uploads directories
RUN mkdir -p uploads/images uploads/documents

# Drop to non-root user for security
RUN chown -R node:node /app
USER node

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "index.js"]
