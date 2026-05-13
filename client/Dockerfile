# Stage 1: Build the React app (runs as non-root for defense-in-depth)
# SHA-pinned. Refresh: `docker pull node:20-alpine && docker inspect --format='{{index .RepoDigests 0}}' node:20-alpine`
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS build

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
FROM nginxinc/nginx-unprivileged:alpine@sha256:0c79d56aee561a1d81c63f00eee5fb5fe29279560cdc55e91425133104c7fbe6

# Copy built assets (default html root is /usr/share/nginx/html, same as nginx:alpine)
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config (must listen on 8080 — unprivileged user cannot bind <1024)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
