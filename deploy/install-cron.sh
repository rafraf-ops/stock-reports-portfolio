#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Financial Analyzer – Install Cron Schedule (Israel Timezone)
#
# Schedule:
#   Start : 07:00 Asia/Jerusalem  (every day)
#   Stop  : 23:00 Asia/Jerusalem  (every day)
#
# Usage (on the Linux server, from repo root):
#   chmod +x deploy/install-cron.sh
#   bash deploy/install-cron.sh
#
# To remove the schedule:
#   bash deploy/install-cron.sh remove
# ─────────────────────────────────────────────────────────────────────────────

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCHEDULER="$REPO_DIR/deploy/scheduler.sh"

# Ensure scheduler is executable
chmod +x "$SCHEDULER"

CRON_TAG="# financial-analyzer scheduler"

remove_crons() {
  crontab -l 2>/dev/null | grep -v "$CRON_TAG" | crontab -
  echo "Removed existing financial-analyzer cron jobs."
}

if [ "${1:-}" = "remove" ]; then
  remove_crons
  echo "Done."
  exit 0
fi

# ── Build cron lines ──────────────────────────────────────────────────────────
# TZ=Asia/Jerusalem is supported in Linux cron (vixie-cron, cronie).
# This correctly handles Israel Standard Time (UTC+2) and
# Israel Daylight Time (UTC+3) automatically – no manual DST adjustments needed.

START_CRON="TZ=Asia/Jerusalem"
STOP_CRON="TZ=Asia/Jerusalem"

START_LINE="0 7  * * *  $SCHEDULER start  >> $REPO_DIR/logs/scheduler.log 2>&1  $CRON_TAG"
STOP_LINE="0 23 * * *  $SCHEDULER stop   >> $REPO_DIR/logs/scheduler.log 2>&1  $CRON_TAG"

# Remove old entries, then add fresh ones
EXISTING=$(crontab -l 2>/dev/null | grep -v "$CRON_TAG")

NEW_CRONTAB="$EXISTING
TZ=Asia/Jerusalem
$START_LINE
$STOP_LINE"

echo "$NEW_CRONTAB" | crontab -

echo ""
echo "═══════════════════════════════════════════════"
echo "  Cron schedule installed (Israel timezone)"
echo ""
echo "  Start  : 07:00 Asia/Jerusalem every day"
echo "  Stop   : 23:00 Asia/Jerusalem every day"
echo ""
echo "  Current Israel time:"
echo "    $(TZ='Asia/Jerusalem' date '+%Y-%m-%d %H:%M:%S %Z')"
echo ""
echo "  Current crontab:"
crontab -l
echo ""
echo "  Log file: $REPO_DIR/logs/scheduler.log"
echo ""
echo "  To remove schedule: bash $REPO_DIR/deploy/install-cron.sh remove"
echo "═══════════════════════════════════════════════"
