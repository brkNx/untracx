#!/usr/bin/env bash
# Revoke a WireGuard peer created by untracx-add-peer.
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

mkdir -p "$(dirname "$LOCK_FILE")"
exec 9> "$LOCK_FILE"
flock -x 9

TMP_SERVER="$(mktemp "/etc/wireguard/.${WG_IFACE}.conf.XXXXXX")"
BACKUP_SERVER="$(mktemp "/etc/wireguard/.${WG_IFACE}.backup.XXXXXX")"
CONF_COMMITTED=0

cleanup() {
  local exit_code=$?
  if [[ "$CONF_COMMITTED" -eq 1 && "$exit_code" -ne 0 && -f "$BACKUP_SERVER" ]]; then
    cp "$BACKUP_SERVER" "$WG_CONF" 2>/dev/null || true
    if command -v wg >/dev/null 2>&1 && command -v wg-quick >/dev/null 2>&1; then
      wg syncconf "$WG_IFACE" <(wg-quick strip "$WG_IFACE") 2>/dev/null || true
    fi
  fi
  rm -f "$TMP_SERVER" "$BACKUP_SERVER"
}
trap cleanup EXIT INT TERM

cp --preserve=mode,ownership "$WG_CONF" "$BACKUP_SERVER"

# Structured block-level parser:
# Matches each [Peer] block and checks if it matches either the marker or the public key.
# Preserves all preceding and following manual peers, comments, and interface configs.
PARSER_OUT=$(awk -v target_pub="${CLIENT_PUBLIC_KEY:-}" -v target_name="${CLIENT_NAME}" '
BEGIN {
  in_peer = 0
  peer_block = ""
  peer_marker = ""
  removed_count = 0
}

function flush_peer() {
  if (in_peer) {
    # Check if this peer block is the target
    is_target = 0
    if (peer_marker == "# untracx-peer: " target_name) {
      is_target = 1
    }
    if (target_pub != "" && peer_block ~ ("PublicKey[[:space:]]*=[[:space:]]*" target_pub)) {
      is_target = 1
    }
    if (is_target) {
      removed_count++
    } else {
      if (peer_marker != "") {
        printf "%s\n", peer_marker
      }
      printf "%s", peer_block
    }
  }
  in_peer = 0
  peer_block = ""
  peer_marker = ""
}

/^# untracx-peer: / {
  flush_peer()
  peer_marker = $0
  next
}

/^\[Peer\]/ {
  flush_peer()
  in_peer = 1
  peer_block = $0 "\n"
  next
}

{
  if (in_peer) {
    peer_block = peer_block $0 "\n"
  } else {
    if (peer_marker != "") {
      printf "%s\n", peer_marker
      peer_marker = ""
    }
    print $0
  }
}

END {
  flush_peer()
  print "REMOVED_COUNT=" removed_count > "/dev/stderr"
}
' "$WG_CONF" 2>"${TMP_SERVER}.meta")

printf '%s\n' "$PARSER_OUT" > "$TMP_SERVER"
# shellcheck disable=SC1090
. "${TMP_SERVER}.meta"
rm -f "${TMP_SERVER}.meta"

if [[ "${REMOVED_COUNT:-0}" -eq 0 ]]; then
  die "peer konfigrasyonda bulunamadi; dosya degistirilmedi (fail-closed)"
fi

chmod 0600 "$TMP_SERVER"
mv "$TMP_SERVER" "$WG_CONF"
CONF_COMMITTED=1

if command -v wg-quick >/dev/null 2>&1 && command -v wg >/dev/null 2>&1; then
  if ! wg syncconf "$WG_IFACE" <(wg-quick strip "$WG_IFACE"); then
    cp "$BACKUP_SERVER" "$WG_CONF"
    wg syncconf "$WG_IFACE" <(wg-quick strip "$WG_IFACE") || true
    die "peer kaldirilamadi; sunucu config geri alindi"
  fi
fi

rm -f "$META_FILE" "$BACKUP_SERVER"
CONF_COMMITTED=0

printf 'Peer iptal edildi: %s (%s)\n' "$CLIENT_NAME" "${CLIENT_IP:-}"
printf 'Bu cihazin eski config dosyasi artik baglanamaz.\n'
