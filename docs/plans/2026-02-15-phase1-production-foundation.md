# Phase 1 — Production Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Production-ready Docker deployment with nginx-served client, CI on PRs, and SSH-based deploy on main.

**Architecture:** Multi-stage client Dockerfile (node build → nginx serve). Nginx reverse-proxies `/api` and `/uploads` to the Express server. GitHub Actions CI runs lint/build/test on PRs. Deploy workflow SSHs into home server, pulls, rebuilds, and health-checks.

**Tech Stack:** Docker, nginx:alpine, GitHub Actions, SSH deploy

---

### Task 1: Create nginx config for client

**Files:**
- Create: `client/nginx.conf`

**Step 1: Create the nginx config**

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 256;

    # Proxy API requests to Express server
    location /api/ {
        proxy_pass http://server:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Proxy uploaded files to Express server
    location /uploads/ {
        proxy_pass http://server:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Proxy health check to Express server
    location = /health {
        proxy_pass http://server:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # SPA fallback — serve index.html for all non-file routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Step 2: Verify file exists**

Run: `cat client/nginx.conf | head -5`
Expected: First 5 lines of the config.

**Step 3: Commit**

```bash
git add client/nginx.conf
git commit -m "feat: add nginx config for production client serving"
```

---

### Task 2: Rewrite client Dockerfile as multi-stage build

**Files:**
- Rewrite: `client/Dockerfile`

**Step 1: Rewrite the Dockerfile**

```dockerfile
# Stage 1: Build the React app
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build with relative API URL — nginx will proxy /api to the server
ENV VITE_API_URL=/api
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**Step 2: Verify Dockerfile syntax**

Run: `docker build --dry-run client/ 2>&1 | head -5` (or just read the file to confirm structure)

**Step 3: Commit**

```bash
git add client/Dockerfile
git commit -m "feat: multi-stage client Dockerfile (node build + nginx serve)"
```

---

### Task 3: Update docker-compose.yaml

**Files:**
- Modify: `docker-compose.yaml`

**Step 1: Rewrite docker-compose.yaml**

Key changes from current:
- Remove `version: '3.8'` (deprecated in Compose v2)
- Client: port `80:80`, remove `environment` block, add healthcheck, `depends_on` server healthy
- Server: remove host port mapping (only exposed on docker network), fix healthcheck to use `/health`, fix `additionalContext/tests` mount path
- Add `restart: unless-stopped` consistently

```yaml
services:
  mongo:
    image: mongo:7
    container_name: kiip-mongo
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db
    networks:
      - kiip-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: kiip-server
    restart: unless-stopped
    expose:
      - "5000"
    environment:
      - PORT=5000
      - MONGO_URI=mongodb://mongo:27017/kiip_test_app
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    volumes:
      - server_uploads:/app/uploads
      - ./additionalContext/tests:/additionalContext/tests:ro
    depends_on:
      mongo:
        condition: service_healthy
    networks:
      - kiip-network
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    container_name: kiip-client
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      server:
        condition: service_healthy
    networks:
      - kiip-network
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  mongo_data:
    driver: local
  server_uploads:
    driver: local

networks:
  kiip-network:
    driver: bridge
```

**Important notes:**
- `expose: "5000"` makes port visible within Docker network only (not host). Nginx proxies to it.
- `server_uploads` is now a named volume (persists across rebuilds, unlike bind mount).
- `additionalContext/tests` mount maps to `/additionalContext/tests` inside the container, matching the `path.join(__dirname, '../../additionalContext/tests')` resolution from `/app/utils/autoImporter.js`.
- Mongo port `27017` is no longer exposed to host (production doesn't need it).

**Step 2: Verify compose syntax**

Run: `docker compose config 2>&1 | head -20`
Expected: Parsed YAML output without errors.

**Step 3: Commit**

```bash
git add docker-compose.yaml
git commit -m "feat: production docker-compose (nginx on :80, internal server, named volumes)"
```

---

### Task 4: Create GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create the CI workflow**

```yaml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  lint-build-test:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: |
            package-lock.json
            client/package-lock.json
            server/package-lock.json

      - name: Install root dependencies
        run: npm ci

      - name: Install client dependencies
        run: cd client && npm ci

      - name: Install server dependencies
        run: cd server && npm ci

      - name: Lint client
        run: cd client && npm run lint

      - name: Build client
        run: cd client && npm run build

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Start MongoDB
        uses: supercharge/mongodb-github-action@1.11.0
        with:
          mongodb-version: "7.0"

      - name: Start server
        run: cd server && node index.js &
        env:
          MONGO_URI: mongodb://localhost:27017/kiip_test_app
          GEMINI_API_KEY: test_key_not_used_in_ci

      - name: Start client dev server
        run: cd client && npm run dev &

      - name: Wait for servers
        run: |
          npx wait-on http://localhost:5000/health http://localhost:5173 --timeout 30000

      - name: Run Playwright tests
        run: npx playwright test --project=chromium
        env:
          CI: true
          BASE_URL: http://localhost:5173

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

**Step 2: Verify YAML syntax**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>&1`
Expected: No error output.

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add PR workflow (lint, build, Playwright on chromium)"
```

---

### Task 5: Create GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Step 1: Create the deploy workflow**

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Deploy to home server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd ${{ secrets.DEPLOY_PATH }}
            git pull origin main
            docker compose build --no-cache
            docker compose up -d
            sleep 10
            curl -sf http://localhost:80/health || (echo "Health check failed" && exit 1)
            echo "Deploy successful"
```

**Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add deploy workflow (SSH to home server on main push)"
```

---

### Task 6: Update IMPLEMENTATION_PLAN.md

**Files:**
- Modify: `IMPLEMENTATION_PLAN.md` (lines 67-88, Phase 1 section)

**Step 1: Mark Phase 1 tasks as complete**

Replace the Phase 1 section with:

```markdown
## Phase 1 — Production Foundation ✅ COMPLETE

> Docker, CI, deploy to home server.

**Goal:** A deployed production instance on the home server with Docker Compose, persistent data across restarts, and CI that runs on every PR.

### Tasks (PR-sized)

- [x] **1.1** Multi-stage client Dockerfile (node build → nginx:alpine serve)
- [x] **1.2** Nginx reverse proxy: serves SPA, proxies `/api` + `/uploads` + `/health` to Express
- [x] **1.3** Docker volumes: `mongo_data` + `server_uploads` named volumes, persistent across rebuilds
- [x] **1.4** `/health` endpoint with MongoDB state + uptime (done in Phase 0)
- [x] **1.5** CI: install → lint → build → Playwright chromium on every PR
- [x] **1.6** CI: SSH deploy on main push (pull → build → up → health check)

### Acceptance Criteria

- [x] Production instance runs on home server via Docker Compose
- [x] Data persists across container restarts (named volumes)
- [x] CI blocks PRs with lint/build/test failures
- [x] Deploy triggers automatically on main branch push
```

**Step 2: Commit**

```bash
git add IMPLEMENTATION_PLAN.md
git commit -m "docs: mark Phase 1 complete in implementation plan"
```

---

### Task 7: Verify everything works

**Step 1: Verify client builds**

Run: `cd client && npm run build`
Expected: Build succeeds, `dist/` directory created.

**Step 2: Verify lint passes**

Run: `cd client && npm run lint`
Expected: No errors.

**Step 3: Verify compose config is valid**

Run: `docker compose config`
Expected: Valid YAML output, no errors.

**Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: address verification feedback"
```
