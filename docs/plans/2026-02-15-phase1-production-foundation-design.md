# Phase 1 — Production Foundation Design

**Date:** 2026-02-15 | **Status:** Approved

## Goal

A deployed production instance on the home server via Docker Compose with persistent data, nginx-served client, and CI that runs on every PR and deploys on main.

## Architecture

### Client: Multi-stage Dockerfile + nginx

- **Stage 1 (build):** `node:20-alpine` — `npm ci`, `VITE_API_URL=/api`, `npm run build` produces `/app/dist`
- **Stage 2 (serve):** `nginx:alpine` — copies `dist/` to `/usr/share/nginx/html`, custom `nginx.conf`, port 80

`VITE_API_URL` is set to `/api` (relative). Nginx reverse-proxies `/api/*` to the server container. This removes hardcoded hostnames from production builds.

### nginx.conf

- Serve static files from `/usr/share/nginx/html`
- Proxy `/api/*` to `http://server:5000/api/*`
- Proxy `/uploads/*` to `http://server:5000/uploads/*`
- Proxy `/health` to `http://server:5000/health`
- SPA fallback: `try_files $uri $uri/ /index.html`
- Gzip enabled for js, css, json, svg

### docker-compose.yaml

- Client: port `80:80`, no runtime env vars (build-time arg), healthcheck on port 80
- Server: port `5000` exposed only to Docker network (not host), healthcheck on `/health`
- MongoDB: unchanged (volume `mongo_data`, healthcheck)
- `additionalContext/tests` volume mount simplified

### CI Pipeline (`.github/workflows/ci.yml`)

- **Trigger:** Pull requests to `main`
- **Steps:** Checkout, Node 20, install deps, lint, build, Playwright tests

### Deploy Pipeline (`.github/workflows/deploy.yml`)

- **Trigger:** Push to `main`
- **Steps:** SSH into home server, git pull, docker compose build, docker compose up -d, health check
- **Secrets:** `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`

## Files

| Action | File |
|--------|------|
| Rewrite | `client/Dockerfile` |
| Create | `client/nginx.conf` |
| Modify | `docker-compose.yaml` |
| Create | `.github/workflows/ci.yml` |
| Create | `.github/workflows/deploy.yml` |
| Modify | `IMPLEMENTATION_PLAN.md` |

## Already Complete

- `/health` endpoint (Phase 0)
- MongoDB volume persistence
- Server uploads volume mount
- Server Dockerfile (production-ready)
- `.dockerignore` files
