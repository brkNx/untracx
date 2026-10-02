#!/usr/bin/env bash
# untracx - Linux Client Fail-Closed Kill-Switch (nftables)
# Blocks all outbound traffic except encrypted tunnel egress, WireGuard endpoint UDP, loopback, and DHCP.
set -euo pipefail

WG_IFACE="${WG_IFACE:-wg0}"
SERVER_IP="${UNTRACX_SERVER_IP:-}"
WG_PORT="${UNTRACX_WG_PORT:-51820}"
BACKUP_FILE="/run/untracx/nftables-backup.nft"

log() {
  printf '[untracx-killswitch] %s\n' "$*"
}

die() {
  printf '[untracx-killswitch] ERROR: %s\n' "$*" >&2
  exit 1
}

[[ $EUID -eq 0 ]] || die "must be run as root (sudo)"
[[ "$WG_IFACE" =~ ^[A-Za-z0-9_=+.-]{1,15}$ ]] || die "invalid WG_IFACE: $WG_IFACE"

enable_ks() {
  log "Enabling kill-switch (nftables inet fail-closed output)..."
  mkdir -p /run/untracx

  if [[ ! -f "$BACKUP_FILE" ]]; then
    nft list ruleset > "$BACKUP_FILE" 2>/dev/null || true
  fi

  nft -f - <<TABLE_CONF
table inet untracx_killswitch {
    chain output {
        type filter hook output priority 0; policy drop;
        oifname "lo" accept
        oifname "$WG_IFACE" accept
        ct state established,related accept
        udp sport 68 udp dport 67 accept
        udp sport 546 udp dport 547 accept
        ip protocol icmp accept
        ip6 nexthdr icmpv6 accept
    }
}
TABLE_CONF

  if [[ -n "$SERVER_IP" && "$SERVER_IP" =~ ^[0-9.]+$ ]]; then
    nft add rule inet untracx_killswitch output ip daddr "$SERVER_IP" udp dport "$WG_PORT" accept
  fi

  log "Kill-switch ACTIVE: All physical egress blocked (only $WG_IFACE allowed)."
}

disable_ks() {
  log "Disabling kill-switch..."
  nft delete table inet untracx_killswitch 2>/dev/null || true
  rm -f "$BACKUP_FILE"
  log "Kill-switch INACTIVE: Standard network traffic restored."
}

status_ks() {
  if nft list table inet untracx_killswitch > /dev/null 2>&1; then
    echo "Kill-switch STATUS: ACTIVE (Interface: $WG_IFACE)"
    nft list table inet untracx_killswitch
  else
    echo "Kill-switch STATUS: INACTIVE"
  fi
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
