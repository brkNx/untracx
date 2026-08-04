#!/usr/bin/env bash
set -euo pipefail

WG_IFACE="${WG_IFACE:-wg0}"

log() {
  printf '[untracx-killswitch] %s\n' "$*"
}

die() {
  printf '[untracx-killswitch] HATA: %s\n' "$*" >&2
  exit 1
}

[[ $EUID -eq 0 ]] || die "root olarak calistirin"

ac() {
  log "Kill-switch aciliyor (ApplicationFirewall)..."

  if ! command -v /usr/libexec/ApplicationFirewall/socketfilterfw > /dev/null 2>&1; then
    die "socketfilterfw bulunamadi; macOS ApplicationFirewall gerekli"
  fi

  /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on

  log "Uygulama katmani kill-switch: Wi-Fi ve Ethernet icin giden trafic sinlendirildi."
  log "Tam network-level kill-switch icin Network Extension kullanilmasi onerenir."
}

kapat() {
  log "Kill-switch kapatiliyor..."
  /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off 2>/dev/null || true
  log "Kill-switch kaldirildi."
}

durum() {
  local state
  state="$(/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null || echo 'bilinmiyor')"
  echo "Firewall durumu: $state"
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