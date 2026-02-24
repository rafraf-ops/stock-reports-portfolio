#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Financial Analyzer – Oracle Cloud Free Tier (Oracle Linux 9) Setup Script
#
# Usage:
#   1. SSH into your Oracle instance:
#        ssh -i ~/.ssh/your-key.pem opc@YOUR_PUBLIC_IP
#   2. Upload this repo (git clone or scp):
#        git clone https://github.com/youruser/financial-analyzer.git
#        cd financial-analyzer
#   3. Run:
#        chmod +x deploy/setup-oracle.sh && sudo bash deploy/setup-oracle.sh
#
# IMPORTANT: After first run, edit backend/.env with your API keys, then:
#        pm2 restart financial-analyzer
# ─────────────────────────────────────────────────────────────────────────────
set -e

# Run from repo root
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_USER="${SUDO_USER:-opc}"

echo ""
echo "═══════════════════════════════════════════════"
echo "  Financial Analyzer – Oracle Linux Setup"
echo "  Repo dir : $REPO_DIR"
echo "  App user : $APP_USER"
echo "═══════════════════════════════════════════════"
echo ""

# ─── 1. System update ────────────────────────────────────────────────────────
echo "▶ [1/10] Updating system packages..."
dnf update -y -q

# ─── 2. Node.js 20 LTS ───────────────────────────────────────────────────────
echo "▶ [2/10] Installing Node.js 20 LTS..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
  dnf install -y nodejs >/dev/null
fi
echo "   node $(node -v)   npm $(npm -v)"

# ─── 3. Git (in case it's missing) ───────────────────────────────────────────
command -v git &>/dev/null || dnf install -y git >/dev/null

# ─── 4. PM2 process manager ──────────────────────────────────────────────────
echo "▶ [3/10] Installing PM2..."
npm install -g pm2 >/dev/null 2>&1
# Enable PM2 autostart as app user
su - "$APP_USER" -c "pm2 startup systemd -u $APP_USER --hp /home/$APP_USER 2>/dev/null | tail -1 | bash" 2>/dev/null || \
  pm2 startup systemd | tail -1 | bash 2>/dev/null || true

# ─── 5. Nginx ────────────────────────────────────────────────────────────────
echo "▶ [4/10] Installing Nginx..."
dnf install -y nginx >/dev/null
systemctl enable nginx >/dev/null 2>&1

# ─── 6. Firewall ─────────────────────────────────────────────────────────────
echo "▶ [5/10] Opening firewall ports (HTTP + HTTPS)..."
firewall-cmd --permanent --add-service=http  2>/dev/null || true
firewall-cmd --permanent --add-service=https 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true

# ─── 7. Backend dependencies ─────────────────────────────────────────────────
echo "▶ [6/10] Installing backend npm packages..."
cd "$REPO_DIR/backend"
npm install --production --silent

# ─── 8. Create .env if missing ───────────────────────────────────────────────
if [ ! -f "$REPO_DIR/backend/.env" ]; then
  echo "▶ [7/10] Creating backend/.env from example..."
  cp "$REPO_DIR/backend/.env.example" "$REPO_DIR/backend/.env"

  # Auto-generate JWT secret
  JWT_SECRET=$(openssl rand -hex 32)
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$REPO_DIR/backend/.env"

  # Set production mode
  sed -i "s|NODE_ENV=development|NODE_ENV=production|" "$REPO_DIR/backend/.env"

  # Set CORS to public IP
  PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "localhost")
  sed -i "s|CORS_ORIGIN=\*|CORS_ORIGIN=http://$PUBLIC_IP|" "$REPO_DIR/backend/.env"

  echo ""
  echo "   ─────────────────────────────────────────────────────────"
  echo "   ⚠  .env created with auto-generated JWT secret."
  echo "   ⚠  To enable optional features, edit:"
  echo "      nano $REPO_DIR/backend/.env"
  echo ""
  echo "   Keys you can add (all free tiers):"
  echo "   CLAUDE_API_KEY     → AI analysis (console.anthropic.com)"
  echo "   FINNHUB_API_KEY    → News & sentiment (finnhub.io)"
  echo "   FMP_API_KEY        → Market cap data (financialmodelingprep.com)"
  echo "   ALPHA_VANTAGE_KEY  → Price fallback (alphavantage.co)"
  echo "   TWELVE_DATA_KEY    → Price fallback (twelvedata.com)"
  echo "   ─────────────────────────────────────────────────────────"
  echo ""
else
  echo "▶ [7/10] backend/.env already exists – skipping"
fi

# ─── 9. Build frontend ───────────────────────────────────────────────────────
echo "▶ [8/10] Building frontend (React + Vite)..."
cd "$REPO_DIR/frontend"
npm install --silent

# Write production env so Vite uses the relative /api path
cat > "$REPO_DIR/frontend/.env.production" <<EOF
VITE_API_URL=/api
EOF

npm run build

# ─── 10. Nginx config ────────────────────────────────────────────────────────
echo "▶ [9/10] Writing Nginx config..."
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "_")

cat > /etc/nginx/conf.d/financial-analyzer.conf <<NGINXEOF
server {
    listen 80 default_server;
    server_name $PUBLIC_IP _;

    # Static frontend files (React build)
    root $REPO_DIR/frontend/dist;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN"          always;
    add_header X-Content-Type-Options "nosniff"      always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               application/x-javascript text/xml application/xml image/svg+xml;

    # API → Node.js backend
    location /api/ {
        proxy_pass         http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }

    # SPA – send all unknown paths to index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
NGINXEOF

# Remove default Nginx page
rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true

nginx -t
systemctl restart nginx
echo "   Nginx started"

# ─── 11. Start backend with PM2 ──────────────────────────────────────────────
echo "▶ [10/10] Starting backend with PM2..."
cd "$REPO_DIR"

# Kill previous instance (ignore errors)
su - "$APP_USER" -c "pm2 delete financial-analyzer 2>/dev/null; true" 2>/dev/null || true

# Start
NODE_ENV=production pm2 start ecosystem.config.cjs --env production --uid "$APP_USER" 2>/dev/null || \
  pm2 start ecosystem.config.cjs --env production

pm2 save

# ─── Done ────────────────────────────────────────────────────────────────────
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "YOUR_PUBLIC_IP")

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅  Setup complete!"
echo ""
echo "  🌐 App URL:     http://$PUBLIC_IP"
echo "  🔌 API URL:     http://$PUBLIC_IP/api"
echo ""
echo "  📋 PM2 status:  pm2 status"
echo "  📋 PM2 logs:    pm2 logs financial-analyzer"
echo "  🔁 Restart:     pm2 restart financial-analyzer"
echo ""
echo "  ─── Oracle Cloud checklist ──────────────────"
echo "  ✅ OS firewall: ports 80/443 open (done above)"
echo "  ❗ OCI console: add Ingress Rule in your VCN"
echo "     Security List → Ingress Rules → Add:"
echo "       Source CIDR: 0.0.0.0/0"
echo "       Protocol: TCP, Port: 80"
echo "     (also port 443 if you add HTTPS later)"
echo ""
echo "  ─── Optional: HTTPS with Let's Encrypt ─────"
echo "  sudo dnf install certbot python3-certbot-nginx -y"
echo "  sudo certbot --nginx -d yourdomain.com"
echo "═══════════════════════════════════════════════"
