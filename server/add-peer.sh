#!/usr/bin/env bash
# Add a WireGuard peer with atomic transaction safety and optional zero-trust client key provisioning.
set -Eeuo pipefail

umask 077

ENV_FILE="/etc/untracx/server.env"
PEER_DIR="/var/lib/untracx/peers"
LOCK_FILE="/run/lock/untracx-peer.lock"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

[[ $EUID -eq 0 ]] || die "must be run as root: sudo untracx-add-peer <device-name> [client-public-key] [preshared-key]"
[[ $# -ge 1 && $# -le 3 ]] || die "usage: sudo untracx-add-peer <device-name> [client-public-key] [preshared-key]"

CLIENT_NAME=$1
[[ "$CLIENT_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$ ]] || \
  die "device name must be 1-32 chars; letters, numbers, dot, underscore, dash only"

CLIENT_PUB_ARG="${2:-}"
PRESHARED_KEY_ARG="${3:-}"

[[ -r "$ENV_FILE" ]] || die "$ENV_FILE not found; run setup.sh first"
# shellcheck disable=SC1090
. "$ENV_FILE"

WG_CONF="/etc/wireguard/${WG_IFACE}.conf"
META_FILE="${PEER_DIR}/${CLIENT_NAME}.env"
[[ -s "$WG_CONF" ]] || die "$WG_CONF not found"

CALLING_USER="${SUDO_USER:-root}"
if [[ "$CALLING_USER" == "root" ]]; then
  CALLING_HOME=/root
  CALLING_GROUP=root
else
  CALLING_HOME="$(getent passwd "$CALLING_USER" | cut -d: -f6)"
  CALLING_GROUP="$(id -gn "$CALLING_USER")"
  [[ -n "$CALLING_HOME" && -d "$CALLING_HOME" ]] || die "sudo user home directory not found"
fi
OUT="${CALLING_HOME}/untracx-${CLIENT_NAME}.conf"

install -d -o root -g root -m 0700 "$PEER_DIR"
mkdir -p "$(dirname "$LOCK_FILE")"
exec 9> "$LOCK_FILE"
flock -x 9

[[ ! -e "$META_FILE" ]] || die "peer named ${CLIENT_NAME} already exists"
if [[ -z "$CLIENT_PUB_ARG" ]]; then
  [[ ! -e "$OUT" ]] || die "$OUT already exists; move or delete it first"
fi

PREFIX="${WG_SUBNET%.*}"
USED_IPS="$(awk -F= '
  /^[[:space:]]*AllowedIPs[[:space:]]*=/ {
    count = split($2, values, ",")
    for (i = 1; i <= count; i++) {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", values[i])
      split(values[i], cidr, "/")
      print cidr[1]
    }
  }
' "$WG_CONF")"

CLIENT_IP=""
for host in $(seq 2 254); do
  candidate="${PREFIX}.${host}"
  [[ "$candidate" == "$WG_SERVER_IP" ]] && continue
  if ! grep -Fqx "$candidate" <<< "$USED_IPS"; then
    CLIENT_IP=$candidate
    break
  fi
done
[[ -n "$CLIENT_IP" ]] || die "no available client IP left in ${WG_SUBNET}"

if [[ -n "$CLIENT_PUB_ARG" ]]; then
  CLIENT_PUB="$CLIENT_PUB_ARG"
  [[ "$CLIENT_PUB" =~ ^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=?$ ]] || die "invalid client public key (base64 curve25519)"
  CLIENT_PRIV=""
  if [[ -n "$PRESHARED_KEY_ARG" ]]; then
    PRESHARED_KEY="$PRESHARED_KEY_ARG"
    [[ "$PRESHARED_KEY" =~ ^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=?$ ]] || die "invalid preshared key (base64)"
  else
    PRESHARED_KEY="$(wg genpsk)"
  fi
else
  CLIENT_PRIV="$(wg genkey)"
  CLIENT_PUB="$(wg pubkey <<< "$CLIENT_PRIV")"
  PRESHARED_KEY="$(wg genpsk)"
fi

SERVER_PUB="$(<"/etc/wireguard/${WG_IFACE}.public.key")"
WG_MTU="${WG_MTU:-1420}"

TMP_CLIENT="$(mktemp "${PEER_DIR}/.untracx-client.XXXXXX")"
TMP_SERVER="$(mktemp "/etc/wireguard/.${WG_IFACE}.conf.XXXXXX")"
BACKUP_SERVER="$(mktemp "/etc/wireguard/.${WG_IFACE}.backup.XXXXXX")"
TMP_META="$(mktemp "${PEER_DIR}/.meta.XXXXXX")"
CONF_COMMITTED=0

cleanup() {
  local exit_code=$?
  if [[ "$CONF_COMMITTED" -eq 1 && "$exit_code" -ne 0 && -f "$BACKUP_SERVER" ]]; then
    cp "$BACKUP_SERVER" "$WG_CONF" 2>/dev/null || true
    if command -v wg >/dev/null 2>&1 && command -v wg-quick >/dev/null 2>&1; then
      wg syncconf "$WG_IFACE" <(wg-quick strip "$WG_IFACE") 2>/dev/null || true
    fi
    rm -f "$META_FILE" "$OUT" 2>/dev/null || true
  fi
  rm -f "$TMP_CLIENT" "$TMP_SERVER" "$BACKUP_SERVER" "$TMP_META"
}
trap cleanup EXIT INT TERM

if [[ -n "$CLIENT_PRIV" ]]; then
  cat > "$TMP_CLIENT" <<CLIENT_EOF
[Interface]
PrivateKey = ${CLIENT_PRIV}
Address = ${CLIENT_IP}/32
DNS = ${WG_DNS}
MTU = ${WG_MTU}

[Peer]
PublicKey = ${SERVER_PUB}
PresharedKey = ${PRESHARED_KEY}
Endpoint = ${PUBLIC_ENDPOINT}:${WG_PORT}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
CLIENT_EOF
  chmod 0600 "$TMP_CLIENT"
fi

cat > "$TMP_META" <<META_EOF
CLIENT_NAME=${CLIENT_NAME}
CLIENT_PUBLIC_KEY=${CLIENT_PUB}
CLIENT_IP=${CLIENT_IP}
PRESHARED_KEY=${PRESHARED_KEY}
META_EOF
chmod 0600 "$TMP_META"

cp --preserve=mode,ownership "$WG_CONF" "$TMP_SERVER"
cp --preserve=mode,ownership "$WG_CONF" "$BACKUP_SERVER"
cat >> "$TMP_SERVER" <<SRV_EOF

# untracx-peer: ${CLIENT_NAME}
[Peer]
PublicKey = ${CLIENT_PUB}
PresharedKey = ${PRESHARED_KEY}
AllowedIPs = ${CLIENT_IP}/32
SRV_EOF
chmod 0600 "$TMP_SERVER"

mv "$TMP_SERVER" "$WG_CONF"
CONF_COMMITTED=1

if command -v wg-quick >/dev/null 2>&1 && command -v wg >/dev/null 2>&1; then
  if ! wg syncconf "$WG_IFACE" <(wg-quick strip "$WG_IFACE"); then
    cp "$BACKUP_SERVER" "$WG_CONF"
    wg syncconf "$WG_IFACE" <(wg-quick strip "$WG_IFACE") || true
    die "failed to apply peer to live configuration; server config rolled back"
  fi
fi

mv "$TMP_META" "$META_FILE"

if [[ -n "$CLIENT_PRIV" ]]; then
  if ! install -o "$CALLING_USER" -g "$CALLING_GROUP" -m 0600 "$TMP_CLIENT" "$OUT"; then
    cp "$BACKUP_SERVER" "$WG_CONF"
    if command -v wg-quick >/dev/null 2>&1 && command -v wg >/dev/null 2>&1; then
      wg syncconf "$WG_IFACE" <(wg-quick strip "$WG_IFACE") || true
    fi
    rm -f "$META_FILE"
    die "failed to export client configuration; peer rolled back"
  fi
fi

CONF_COMMITTED=0
rm -f "$BACKUP_SERVER"

printf 'Peer added: %s -> %s\n' "$CLIENT_NAME" "$CLIENT_IP"
if [[ -n "$CLIENT_PRIV" ]]; then
  printf 'Client config: %s (owner: %s, mode: 0600)\n' "$OUT" "$CALLING_USER"
  printf 'After copying this file to your device, delete this server copy.\n'
else
  printf 'Zero-trust mode: No private key was generated on the server.\n'
  printf 'PresharedKey: %s\n' "$PRESHARED_KEY"
fi
