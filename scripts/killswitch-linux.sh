#!/usr/bin/env bash
set -euo pipefail

WG_IFACE="${WG_IFACE:-wg0}"
WG_SUBNET="${WG_SUBNET:-10.66.66.0/24}"
OUT_IFACE=""

log() {
  printf '[untracx-killswitch] %s\n' "$*"
}

die() {
  printf '[untracx-killswitch] HATA: %s\n' "$*" >&2
  exit 1
}

[[ $EUID -eq 0 ]] || die "root olarak calistirin"

# SECURITY: Validate environment variables to prevent nftables command injection
[[ "$WG_IFACE" =~ ^[A-Za-z0-9_=+.-]{1,15}$ ]] || die "gecersiz WG_IFACE: $WG_IFACE"
[[ "$WG_SUBNET" =~ ^[0-9./]+$ ]] || die "gecersiz WG_SUBNET: $WG_SUBNET"

detect_out_iface() {
  OUT_IFACE="$(ip -4 route show default | awk 'NR == 1 { print $5 }')"
  [[ -n "$OUT_IFACE" ]] || die "varsayilan dis arayuz bulunamadi"
}

ac() {
  detect_out_iface
  log "Kill-switch aciliyor (nftables, IPv4 + IPv6)..."

  # IPv4: tünelden gelen harici trafik disinda FORWARD kapali.
  nft add table ip untracx 2>/dev/null || true
  nft add chain ip untracx forward '{ type filter hook forward priority 0; policy drop; }' 2>/dev/null || true
  nft add chain ip untracx output '{ type filter hook output priority 0; policy accept; }' 2>/dev/null || true

  nft add rule ip untracx forward iifname "$WG_IFACE" oifname "$OUT_IFACE" ip saddr "$WG_SUBNET" accept
  nft add rule ip untracx forward iifname "$OUT_IFACE" oifname "$WG_IFACE" ip daddr "$WG_SUBNET" ct state established,related accept
  nft add rule ip untracx output oifname "$WG_IFACE" accept

  nft add rule ip untracx forward iifname "$WG_IFACE" oifname "$WG_IFACE" accept
  nft add rule ip untracx forward iifname lo oifname lo accept

  # IPv6: istemci AllowedIPs icinde ::/0 var; sizintiyi onlemek icin ayni
  # mantik ip6 family'sinda da kurulur (subnet IPv4 oldugu icin yalniz arayuz bazli).
  nft add table ip6 untracx 2>/dev/null || true
  nft add chain ip6 untracx forward '{ type filter hook forward priority 0; policy drop; }' 2>/dev/null || true
  nft add chain ip6 untracx output '{ type filter hook output priority 0; policy accept; }' 2>/dev/null || true

  nft add rule ip6 untracx forward iifname "$WG_IFACE" oifname "$OUT_IFACE" accept
  nft add rule ip6 untracx forward iifname "$OUT_IFACE" oifname "$WG_IFACE" ct state established,related accept
  nft add rule ip6 untracx output oifname "$WG_IFACE" accept

  nft add rule ip6 untracx forward iifname "$WG_IFACE" oifname "$WG_IFACE" accept
  nft add rule ip6 untracx forward iifname lo oifname lo accept

  log "Kill-switch aktif (v4+v6): WG_IFACE=$WG_IFACE OUT_IFACE=$OUT_IFACE"
}

kapat() {
  log "Kill-switch kapatiliyor (nftables)..."
  nft delete table ip untracx 2>/dev/null || true
  nft delete table ip6 untracx 2>/dev/null || true
  log "Kill-switch kaldirildi; tum trafic normal yoldan gidecek."
}

durum() {
  if nft list table ip untracx > /dev/null 2>&1 || nft list table ip6 untracx > /dev/null 2>&1; then
    echo "Kill-switch ACIK:"
    nft list table ip untracx 2>/dev/null
    echo "---"
    nft list table ip6 untracx 2>/dev/null
  else
    echo "Kill-switch KAPALI"
  fi
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