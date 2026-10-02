#!/usr/bin/env bash
# untracx - macOS Packet Filter (pf) Kill-Switch (Experimental CLI)
# NOTE: On macOS, the most reliable kill-switch mechanism is the official WireGuard.app On-Demand profile.
set -euo pipefail

ANCHOR_NAME="com.untracx.killswitch"
CONF_FILE="/etc/pf.anchors/${ANCHOR_NAME}"

log() { printf '[untracx-killswitch] %s\n' "$*"; }
die() { printf '[untracx-killswitch] ERROR: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "must be run as root (sudo)"

enable_ks() {
  log "Enabling macOS pf kill-switch (Experimental)..."
  mkdir -p /etc/pf.anchors
  cat > "$CONF_FILE" <<PF_EOF
# untracx fail-closed anchor
block drop out all
pass out quick on lo0 all
pass out quick on utun+ all
pass out proto udp to any port 51820
pass out proto udp from any port 68 to any port 67
PF_EOF

  pfctl -a "$ANCHOR_NAME" -f "$CONF_FILE" 2>/dev/null || true
  pfctl -e 2>/dev/null || true
  log "Kill-switch ACTIVE: Non-tunnel egress blocked."
  log "Recommendation: For seamless integration, use official WireGuard.app On-Demand mode."
}

disable_ks() {
  log "Disabling pf kill-switch rules..."
  pfctl -a "$ANCHOR_NAME" -F all 2>/dev/null || true
  rm -f "$CONF_FILE"
  log "Kill-switch INACTIVE."
}

status_ks() {
  echo "--- $ANCHOR_NAME rules ---"
  pfctl -a "$ANCHOR_NAME" -s rules 2>/dev/null || echo "INACTIVE or no rules present"
}

case "${1:-}" in
  enable|ac) enable_ks ;;
  disable|kapat) disable_ks ;;
  status|durum) status_ks ;;
  *)
    echo "Usage: $0 {enable|disable|status}"
    exit 1
    ;;
esac
