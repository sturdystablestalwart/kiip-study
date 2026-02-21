#!/usr/bin/env bash
# Local development setup for KIIP Study
# Usage: bash scripts/setup-local.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }

echo ""
echo "=== KIIP Study — Local Development Setup ==="
echo ""

# ─── Check prerequisites ───

echo "Checking prerequisites..."

if command -v node &>/dev/null; then
  ok "Node.js $(node -v)"
else
  fail "Node.js not found — install from https://nodejs.org"
  exit 1
fi

if command -v mongosh &>/dev/null; then
  ok "mongosh found"
elif command -v mongo &>/dev/null; then
  ok "mongo shell found"
else
  warn "MongoDB shell not found — make sure MongoDB is running"
fi

# Check if MongoDB is reachable
if mongosh --eval "db.adminCommand('ping')" --quiet &>/dev/null 2>&1; then
  ok "MongoDB is running"
elif command -v docker &>/dev/null && docker ps --filter "ancestor=mongo" --filter "status=running" -q 2>/dev/null | grep -q .; then
  ok "MongoDB running in Docker"
else
  warn "MongoDB does not seem to be running"
  echo "     Start it with: mongod  (local install)"
  echo "     Or:            docker run -d -p 27017:27017 --name kiip-mongo mongo:7"
fi

echo ""

# ─── Create .env files from examples ───

echo "Setting up environment files..."

create_env() {
  local src="$1"
  local dst="$2"
  local label="$3"
  if [ -f "$dst" ]; then
    ok "$label .env already exists — skipping"
  elif [ -f "$src" ]; then
    cp "$src" "$dst"
    ok "$label .env created from example"
    warn "Edit $dst and fill in your API keys"
  else
    fail "$src not found"
  fi
}

create_env "server/.env.example" "server/.env" "Server"
create_env "client/.env.example" "client/.env" "Client"

echo ""

# ─── Install dependencies ───

echo "Installing dependencies..."
npm run install-all
ok "Dependencies installed"

echo ""

# ─── Install Playwright browsers (optional) ───

if [ "${SKIP_PLAYWRIGHT:-}" != "1" ]; then
  echo "Installing Playwright browsers (Chromium only)..."
  npx playwright install chromium
  ok "Playwright Chromium installed"
else
  warn "Skipping Playwright install (SKIP_PLAYWRIGHT=1)"
fi

echo ""

# ─── Summary ───

echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit server/.env — add your GEMINI_API_KEY and Google OAuth credentials"
echo "  2. Start development:   npm start"
echo "  3. Open the app:        http://localhost:5173"
echo "  4. Run tests:           npx playwright test --project=chromium"
echo ""
echo "Without Google OAuth credentials the app still works for browsing and"
echo "taking tests — sign-in and admin features will be unavailable."
echo ""
echo "Without GEMINI_API_KEY the AI test generation endpoint will fail,"
echo "but you can still use the 5 auto-imported sample tests."
echo ""
