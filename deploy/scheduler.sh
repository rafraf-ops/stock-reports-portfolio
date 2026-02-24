#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Financial Analyzer – Night/Morning Scheduler
#
# Shuts the app down at night and wakes it up in the morning.
# Times are in Israel timezone (Asia/Jerusalem).
#   • Morning start : 07:00 Israel time
#   • Night stop    : 23:00 Israel time
#
# INSTALL:
#   chmod +x deploy/scheduler.sh
#   bash deploy/install-cron.sh        ← runs this for you
#
# MANUAL USE:
#   bash deploy/scheduler.sh start     ← start now
#   bash deploy/scheduler.sh stop      ← stop now
#   bash deploy/scheduler.sh status    ← show status
# ─────────────────────────────────────────────────────────────────────────────

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$REPO_DIR/logs/scheduler.log"
APP_NAME="financial-analyzer"

# Make sure log dir exists
mkdir -p "$REPO_DIR/logs"

log() {
  echo "[$(TZ='Asia/Jerusalem' date '+%Y-%m-%d %H:%M:%S %Z')] $*" | tee -a "$LOG_FILE"
}

# ── Find pm2 ──────────────────────────────────────────────────────────────────
PM2=$(command -v pm2 || echo "")
if [ -z "$PM2" ]; then
  # Try common npm global paths
  for p in /usr/local/bin/pm2 /usr/bin/pm2 ~/.npm-global/bin/pm2 /home/opc/.npm-global/bin/pm2; do
    [ -x "$p" ] && PM2="$p" && break
  done
fi
if [ -z "$PM2" ]; then
  log "ERROR: pm2 not found. Install with: npm install -g pm2"
  exit 1
fi

# ── Commands ──────────────────────────────────────────────────────────────────
do_start() {
  log "▶ Starting $APP_NAME..."
  cd "$REPO_DIR" || exit 1

  # Check if already running
  STATUS=$($PM2 jlist 2>/dev/null | python3 -c "
import json,sys
try:
  apps = json.load(sys.stdin)
  app = next((a for a in apps if a.get('name') == '$APP_NAME'), None)
  print(app['pm2_env']['status'] if app else 'NOT_FOUND')
except: print('ERROR')
" 2>/dev/null || echo "UNKNOWN")

  if [ "$STATUS" = "online" ]; then
    log "  Already online – nothing to do."
  elif [ "$STATUS" = "stopped" ] || [ "$STATUS" = "errored" ]; then
    $PM2 start "$APP_NAME" >> "$LOG_FILE" 2>&1
    log "  Started from stopped state."
  else
    # Not registered at all – start fresh
    $PM2 start ecosystem.config.cjs >> "$LOG_FILE" 2>&1
    $PM2 save >> "$LOG_FILE" 2>&1
    log "  Started fresh."
  fi

  # Also restart nginx if it stopped
  if command -v systemctl &>/dev/null; then
    systemctl is-active --quiet nginx || { systemctl start nginx && log "  Nginx restarted."; }
  fi

  log "✅ App is UP."
}

do_stop() {
  log "▶ Stopping $APP_NAME..."
  $PM2 stop "$APP_NAME" >> "$LOG_FILE" 2>&1 && log "  PM2 app stopped." || log "  (app was already stopped or not found)"
  log "🌙 App is DOWN for the night."
}

do_status() {
  echo ""
  echo "Israel time : $(TZ='Asia/Jerusalem' date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "Server UTC  : $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo ""
  $PM2 status "$APP_NAME" 2>/dev/null || echo "PM2 app not found"
  echo ""
  echo "Last 20 scheduler log lines:"
  tail -20 "$LOG_FILE" 2>/dev/null || echo "(no log yet)"
}

# ── Main ──────────────────────────────────────────────────────────────────────
case "${1:-status}" in
  start)  do_start ;;
  stop)   do_stop  ;;
  status) do_status ;;
  *)
    echo "Usage: $0 {start|stop|status}"
    exit 1
    ;;
esac
