# Issue #199 — multi-stage so the runtime layer ships only node + the
# already-installed node_modules + app source.  No npm, no lockfile, no
# apk metadata reach the production image.  Matches client/Dockerfile.
#
# SHA-pinned base for reproducible/secure builds.
# To refresh: `docker pull node:20-alpine && docker inspect --format='{{index .RepoDigests 0}}' node:20-alpine`
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS deps

WORKDIR /app

# Only the lockfile is needed for `npm ci` — copying just package*.json
# means an unrelated app-source edit won't bust this layer's cache.
COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

# ---------- runtime stage ----------
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS runtime

WORKDIR /app

# Pull only the resolved production node_modules; npm + lockfile stay
# in the `deps` layer and never reach the final image.
COPY --from=deps /app/node_modules ./node_modules

# Application source (filtered by .dockerignore).
COPY . .

# Create uploads directories (build-time stub — the entrypoint re-creates
# them at runtime so a volume mount can't leave them missing).
RUN mkdir -p uploads/images uploads/documents uploads/temp

# Issue #124 — entrypoint script mkdirs BEFORE node starts so the
# server_uploads named volume mount overlay can't race with the
# fs.mkdirSync in server/index.js when multer-handled requests arrive
# during cold start.
RUN chmod +x /app/entrypoint.sh

# Drop to non-root user for security
RUN chown -R node:node /app
USER node

EXPOSE 5000

# Image-level liveness signal (#200). Compose adds its own healthcheck,
# but a `docker run` for diagnostics or any future orchestrator that
# reads HEALTHCHECK directly needs this baked in.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider http://localhost:5000/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
