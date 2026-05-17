# Stage 1: Build the React app (runs as non-root for defense-in-depth)
# SHA-pinned. Refresh: `docker pull node:20-alpine && docker inspect --format='{{index .RepoDigests 0}}' node:20-alpine`
FROM node:26-alpine@sha256:e71ac5e964b9201072425d59d2e876359efa25dc96bb1768cb73295728d6e4ea AS build

WORKDIR /app
RUN chown -R node:node /app
USER node

COPY --chown=node:node package*.json ./
RUN npm ci

COPY --chown=node:node . .

# Build with relative API URL — nginx will proxy /api to the server
ENV VITE_API_URL=/api
RUN npm run build

# Stage 2: Serve with nginx as non-root user (listens on 8080, no root needed)
# SHA-pinned. Refresh: `docker pull nginxinc/nginx-unprivileged:alpine && docker inspect --format='{{index .RepoDigests 0}}' nginxinc/nginx-unprivileged:alpine`
FROM nginxinc/nginx-unprivileged:alpine@sha256:4c18337659c90a01627f2e152b7c89524521c82dcedb255dc83d3689642b0803

# Copy built assets (default html root is /usr/share/nginx/html, same as nginx:alpine)
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config (must listen on 8080 — unprivileged user cannot bind <1024)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

# Image-level liveness signal (#200). Compose adds its own; this covers
# any standalone `docker run` and future orchestrator that reads
# HEALTHCHECK directly.  nginx-unprivileged ships wget in busybox.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
