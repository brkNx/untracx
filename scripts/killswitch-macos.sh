#!/usr/bin/env bash
# untracx - macOS Packet Filter (pf) Kill-Switch (Experimental CLI)
# NOT: macOS uzerinde en guvenilir kill-switch resmi WireGuard.app On-Demand profilidir.
set -euo pipefail

ANCHOR_NAME="com.untracx.killswitch"
CONF_FILE="/etc/pf.anchors/${ANCHOR_NAME}"

log() { printf '[untracx-killswitch] %s\n' "$*"; }
die() { printf '[untracx-killswitch] HATA: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "root olarak calistirin (sudo)"

ac() {
  log "macOS pf kill-switch etkinlestiriliyor (Deneysel)..."
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
  log "Kill-switch AKTIF: utun ve endpoint disindaki cikislar engellendi."
  log "Tavsiye: Tam entegrasyon icin resmi WireGuard.app On-Demand profilini kullanin."
}

kapat() {
  log "pf kill-switch kurallari kaldiriliyor..."
  pfctl -a "$ANCHOR_NAME" -F all 2>/dev/null || true
  rm -f "$CONF_FILE"
  log "Kill-switch KAPALI."
}

durum() {
  echo "--- $ANCHOR_NAME kurallari ---"
  pfctl -a "$ANCHOR_NAME" -s rules 2>/dev/null || echo "KAPALI veya kural yok"
}

case "${1:-}" in
  ac) ac ;;
  kapat) kapat ;;
  durum) durum ;;
  *)
    echo "Kullanim: $0 {ac|kapat|durum}"
    exit 1
    ;;
esac
