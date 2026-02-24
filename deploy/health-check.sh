#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Financial Analyzer – Health Check & Diagnostics
# Run this on the Linux server to verify all services are working.
#
# Usage:
#   chmod +x deploy/health-check.sh
#   bash deploy/health-check.sh
# ─────────────────────────────────────────────────────────────────────────────

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$REPO_DIR/backend"
BACKEND_URL="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }

echo ""
echo "═══════════════════════════════════════════════"
echo "  Financial Analyzer – Health Check"
echo "  $(date)"
echo "═══════════════════════════════════════════════"

# ── 1. Node.js ────────────────────────────────────────────────────────────────
echo ""
echo "▶ Node.js"
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  ok "node installed: $NODE_VER"
  if [[ "$NODE_VER" < "v18" ]]; then
    warn "Node.js 18+ recommended (you have $NODE_VER)"
  fi
else
  fail "node not found – run: curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && dnf install -y nodejs"
fi

# ── 2. PM2 ────────────────────────────────────────────────────────────────────
echo ""
echo "▶ PM2 Process Manager"
if command -v pm2 &>/dev/null; then
  ok "pm2 installed: $(pm2 -v)"
  APP_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import json,sys
try:
  apps = json.load(sys.stdin)
  app = next((a for a in apps if a.get('name') == 'financial-analyzer'), None)
  print(app['pm2_env']['status'] if app else 'NOT_FOUND')
except:
  print('ERROR')
" 2>/dev/null || echo "UNKNOWN")
  case "$APP_STATUS" in
    online)  ok "financial-analyzer app: ONLINE" ;;
    stopped) warn "financial-analyzer app: STOPPED (run: pm2 start ecosystem.config.cjs)" ;;
    NOT_FOUND) fail "financial-analyzer not in PM2 (run: pm2 start ecosystem.config.cjs from repo root)" ;;
    *)       warn "financial-analyzer status: $APP_STATUS" ;;
  esac
else
  fail "pm2 not found – run: npm install -g pm2"
fi

# ── 3. Nginx ──────────────────────────────────────────────────────────────────
echo ""
echo "▶ Nginx"
if command -v nginx &>/dev/null; then
  ok "nginx installed"
  if systemctl is-active --quiet nginx 2>/dev/null; then
    ok "nginx service: RUNNING"
  else
    fail "nginx service: NOT RUNNING (run: systemctl start nginx)"
  fi
else
  warn "nginx not installed (only needed for production)"
fi

# ── 4. Backend .env ───────────────────────────────────────────────────────────
echo ""
echo "▶ Backend .env"
ENV_FILE="$BACKEND_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  ok ".env file exists"

  check_env() {
    local key=$1 label=$2 required=$3
    local val
    val=$(grep "^${key}=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' | xargs 2>/dev/null)
    if [ -n "$val" ] && [ "$val" != "your-secret-key-change-in-production" ] && [ "$val" != "change_this_to_a_long_random_string_in_production" ]; then
      ok "$label: set (${val:0:8}...)"
    elif [ "$required" = "required" ]; then
      fail "$label: MISSING or default – add to $ENV_FILE"
    else
      warn "$label: not set (optional)"
    fi
  }

  check_env "JWT_SECRET"        "JWT_SECRET"       "required"
  check_env "CLAUDE_API_KEY"    "Claude API key"   "required"
  check_env "FMP_API_KEY"       "FMP API key"      "optional"
  check_env "ALPHA_VANTAGE_KEY" "Alpha Vantage key" "optional"
  check_env "FINNHUB_API_KEY"   "Finnhub key"      "optional"

  PORT=$(grep "^PORT=" "$ENV_FILE" | cut -d= -f2 | xargs 2>/dev/null)
  ok "PORT: ${PORT:-3000 (default)}"

  NODE_ENV=$(grep "^NODE_ENV=" "$ENV_FILE" | cut -d= -f2 | xargs 2>/dev/null)
  ok "NODE_ENV: ${NODE_ENV:-development (default)}"
else
  fail ".env not found at $ENV_FILE"
  echo "     Copy from example: cp $BACKEND_DIR/.env.example $ENV_FILE"
fi

# ── 5. Database ───────────────────────────────────────────────────────────────
echo ""
echo "▶ Database"
DB_FILE="$BACKEND_DIR/database.db"
if [ -f "$DB_FILE" ]; then
  DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
  ok "database.db exists ($DB_SIZE)"
else
  warn "database.db not found – will be created on first start"
fi

# ── 6. node_modules (native binaries) ─────────────────────────────────────────
echo ""
echo "▶ Backend node_modules"
if [ -d "$BACKEND_DIR/node_modules" ]; then
  ok "node_modules exists"
  # Check better-sqlite3 native binding
  BINDING="$BACKEND_DIR/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
  if [ -f "$BINDING" ]; then
    # Check if compiled for current platform
    FILE_OUTPUT=$(file "$BINDING" 2>/dev/null)
    if echo "$FILE_OUTPUT" | grep -q "ELF"; then
      ok "better-sqlite3 native: Linux binary ✓"
    elif echo "$FILE_OUTPUT" | grep -q "PE32"; then
      fail "better-sqlite3 native: Windows binary detected! Run: cd $BACKEND_DIR && npm rebuild"
    else
      warn "better-sqlite3 native: unknown format – run npm rebuild if errors occur"
    fi
  else
    warn "better-sqlite3 binding not found – run: cd $BACKEND_DIR && npm install"
  fi
else
  fail "node_modules missing – run: cd $BACKEND_DIR && npm install"
fi

# ── 7. API endpoints ──────────────────────────────────────────────────────────
echo ""
echo "▶ API Endpoints"
if command -v curl &>/dev/null; then
  # Health check
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$BACKEND_URL/" 2>/dev/null)
  if [ "$HTTP_STATUS" = "200" ]; then
    ok "GET / → 200 OK"
  else
    fail "GET / → $HTTP_STATUS (backend not responding on port ${PORT:-3000})"
  fi

  # Auth endpoint
  AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"dev@local.com","password":"password123"}' \
    "$BACKEND_URL/api/auth/login" 2>/dev/null)
  if [ "$AUTH_STATUS" = "200" ]; then
    ok "POST /api/auth/login (dev@local.com) → 200 OK"
  elif [ "$AUTH_STATUS" = "401" ]; then
    warn "POST /api/auth/login → 401 (dev user may not exist yet)"
  else
    fail "POST /api/auth/login → $AUTH_STATUS"
  fi

  # Companies endpoint
  COMPANIES_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$BACKEND_URL/api/companies" 2>/dev/null)
  if [ "$COMPANIES_STATUS" = "200" ]; then
    ok "GET /api/companies → 200 OK"
  else
    fail "GET /api/companies → $COMPANIES_STATUS"
  fi

  # Stock price endpoint
  STOCK_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BACKEND_URL/api/stock-price/AAPL" 2>/dev/null)
  if [ "$STOCK_STATUS" = "200" ]; then
    ok "GET /api/stock-price/AAPL → 200 OK"
  else
    warn "GET /api/stock-price/AAPL → $STOCK_STATUS (external API may be slow/down)"
  fi
else
  warn "curl not available – skipping API tests"
fi

# ── 8. Frontend build ──────────────────────────────────────────────────────────
echo ""
echo "▶ Frontend"
DIST_DIR="$REPO_DIR/frontend/dist"
if [ -d "$DIST_DIR" ] && [ -f "$DIST_DIR/index.html" ]; then
  DIST_SIZE=$(du -sh "$DIST_DIR" | cut -f1)
  ok "frontend/dist exists ($DIST_SIZE) – built and ready"
else
  warn "frontend/dist missing – run: cd $REPO_DIR/frontend && npm install && npm run build"
fi

# ── 9. Google OAuth warning ───────────────────────────────────────────────────
echo ""
echo "▶ Google OAuth"
GOOGLE_ID=$(grep "^VITE_GOOGLE_CLIENT_ID=" "$REPO_DIR/frontend/.env" 2>/dev/null | cut -d= -f2 | xargs)
if [ -n "$GOOGLE_ID" ]; then
  ok "VITE_GOOGLE_CLIENT_ID set: ${GOOGLE_ID:0:20}..."
  PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "unknown")
  warn "Verify this IP is in Google Console authorized origins: http://$PUBLIC_IP"
  warn "Google Console: https://console.cloud.google.com/apis/credentials"
else
  warn "VITE_GOOGLE_CLIENT_ID not set in frontend/.env – Google login disabled"
fi

# ── 10. AMZN "not found" explanation ──────────────────────────────────────────
echo ""
echo "▶ Company Search (AMZN 'not found' issue)"
warn "AMZN and other non-seeded companies must be added via the Refresh button."
warn "Only these 7 companies are pre-seeded: NVDA, AAPL, MSFT, GOOGL, TSLA, AMD, INTC"
echo "     To add AMZN: click the company → press Refresh, or:"
echo "       curl -X POST $BACKEND_URL/api/companies/AMZN/refresh"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  Done. Fix any ✗ items above, then:"
echo "  pm2 restart financial-analyzer"
echo "═══════════════════════════════════════════════"
echo ""
