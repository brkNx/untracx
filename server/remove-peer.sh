#!/usr/bin/env bash
# Revoke a peer created by untracx-add-peer.
set -Eeuo pipefail

umask 077

ENV_FILE="/etc/untracx/server.env"
PEER_DIR="/var/lib/untracx/peers"
LOCK_FILE="/run/lock/untracx-peer.lock"

die() {
  printf 'HATA: %s\n' "$*" >&2
  exit 1
}

[[ $EUID -eq 0 ]] || die "root olarak calistirin: sudo untracx-remove-peer <cihaz-adi>"
[[ $# -eq 1 ]] || die "kullanim: sudo untracx-remove-peer <cihaz-adi>"

CLIENT_NAME=$1
[[ "$CLIENT_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$ ]] || die "gecersiz cihaz adi"
[[ -r "$ENV_FILE" ]] || die "$ENV_FILE bulunamadi"
# shellcheck disable=SC1090
. "$ENV_FILE"

WG_CONF="/etc/wireguard/${WG_IFACE}.conf"
META_FILE="${PEER_DIR}/${CLIENT_NAME}.env"
[[ -r "$META_FILE" ]] || die "${CLIENT_NAME} adli yonetilen peer bulunamadi"
# shellcheck disable=SC1090
. "$META_FILE"

exec 9> "$LOCK_FILE"
flock -x 9

TMP_SERVER="$(mktemp "/etc/wireguard/.${WG_IFACE}.conf.XXXXXX")"
BACKUP_SERVER="$(mktemp "/etc/wireguard/.${WG_IFACE}.backup.XXXXXX")"
cleanup() {
  rm -f "$TMP_SERVER" "$BACKUP_SERVER"
}
trap cleanup EXIT

cp --preserve=mode,ownership "$WG_CONF" "$BACKUP_SERVER"
awk -v marker="# untracx-peer: ${CLIENT_NAME}" '
  $0 == marker { skipping = 1; next }
  skipping && /^# untracx-peer: / { skipping = 0 }
  !skipping { print }
' "$WG_CONF" > "$TMP_SERVER"
chmod 0600 "$TMP_SERVER"
mv "$TMP_SERVER" "$WG_CONF"

if ! wg syncconf "$WG_IFACE" <(wg-quick strip "$WG_IFACE"); then
  mv "$BACKUP_SERVER" "$WG_CONF"
  wg syncconf "$WG_IFACE" <(wg-quick strip "$WG_IFACE") || true
  die "peer kaldirilamadi; sunucu config geri alindi"
fi

rm -f "$META_FILE" "$BACKUP_SERVER"
printf 'Peer iptal edildi: %s (%s)\n' "$CLIENT_NAME" "$CLIENT_IP"
printf 'Bu cihazin eski config dosyasi artik baglanamaz.\n'
