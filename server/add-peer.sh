#!/usr/bin/env bash
# Add a WireGuard peer without ever printing private key material to stdout.
set -Eeuo pipefail

umask 077

ENV_FILE="/etc/untracx/server.env"
PEER_DIR="/var/lib/untracx/peers"
LOCK_FILE="/run/lock/untracx-peer.lock"

die() {
  printf 'HATA: %s\n' "$*" >&2
  exit 1
}

[[ $EUID -eq 0 ]] || die "root olarak calistirin: sudo untracx-add-peer <cihaz-adi>"
[[ $# -eq 1 ]] || die "kullanim: sudo untracx-add-peer <cihaz-adi>"

CLIENT_NAME=$1
[[ "$CLIENT_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$ ]] || \
  die "cihaz adi 1-32 karakter olmali; yalniz harf, rakam, nokta, alt cizgi ve tire kullanin"
[[ -r "$ENV_FILE" ]] || die "$ENV_FILE bulunamadi; once setup.sh calistirin"
# shellcheck disable=SC1090
. "$ENV_FILE"

WG_CONF="/etc/wireguard/${WG_IFACE}.conf"
META_FILE="${PEER_DIR}/${CLIENT_NAME}.env"
[[ -s "$WG_CONF" ]] || die "$WG_CONF bulunamadi"
wg show "$WG_IFACE" > /dev/null 2>&1 || die "$WG_IFACE aktif degil"

CALLING_USER="${SUDO_USER:-root}"
if [[ "$CALLING_USER" == "root" ]]; then
  CALLING_HOME=/root
  CALLING_GROUP=root
else
  CALLING_HOME="$(getent passwd "$CALLING_USER" | cut -d: -f6)"
  CALLING_GROUP="$(id -gn "$CALLING_USER")"
  [[ -n "$CALLING_HOME" && -d "$CALLING_HOME" ]] || die "sudo kullanicisinin home dizini bulunamadi"
fi
OUT="${CALLING_HOME}/untracx-${CLIENT_NAME}.conf"

install -d -o root -g root -m 0700 "$PEER_DIR"
exec 9> "$LOCK_FILE"
flock -x 9

[[ ! -e "$META_FILE" ]] || die "${CLIENT_NAME} adli peer zaten var"
[[ ! -e "$OUT" ]] || die "$OUT zaten var; once guvenli bir yere tasiyin veya silin"

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
[[ -n "$CLIENT_IP" ]] || die "${WG_SUBNET} icinde bos istemci adresi kalmadi"

CLIENT_PRIV="$(wg genkey)"
CLIENT_PUB="$(wg pubkey <<< "$CLIENT_PRIV")"
PRESHARED_KEY="$(wg genpsk)"
SERVER_PUB="$(<"/etc/wireguard/${WG_IFACE}.public.key")"

TMP_CLIENT="$(mktemp /tmp/untracx-client.XXXXXX)"
TMP_SERVER="$(mktemp "/etc/wireguard/.${WG_IFACE}.conf.XXXXXX")"
BACKUP_SERVER="$(mktemp "/etc/wireguard/.${WG_IFACE}.backup.XXXXXX")"
cleanup() {
  rm -f "$TMP_CLIENT" "$TMP_SERVER" "$BACKUP_SERVER"
}
trap cleanup EXIT

WG_MTU="${WG_MTU:-1420}"
cat > "$TMP_CLIENT" <<EOF
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
EOF
chmod 0600 "$TMP_CLIENT"

cp --preserve=mode,ownership "$WG_CONF" "$TMP_SERVER"
cp --preserve=mode,ownership "$WG_CONF" "$BACKUP_SERVER"
cat >> "$TMP_SERVER" <<EOF

# untracx-peer: ${CLIENT_NAME}
[Peer]
PublicKey = ${CLIENT_PUB}
PresharedKey = ${PRESHARED_KEY}
AllowedIPs = ${CLIENT_IP}/32
EOF
chmod 0600 "$TMP_SERVER"

mv "$TMP_SERVER" "$WG_CONF"
if ! wg syncconf "$WG_IFACE" <(wg-quick strip "$WG_IFACE"); then
  mv "$BACKUP_SERVER" "$WG_CONF"
  wg syncconf "$WG_IFACE" <(wg-quick strip "$WG_IFACE") || true
  die "peer canli yapilandirmaya uygulanamadi; sunucu config geri alindi"
fi

if ! install -o "$CALLING_USER" -g "$CALLING_GROUP" -m 0600 "$TMP_CLIENT" "$OUT"; then
  mv "$BACKUP_SERVER" "$WG_CONF"
  wg syncconf "$WG_IFACE" <(wg-quick strip "$WG_IFACE") || true
  die "istemci config disari aktarilamadi; peer geri alindi"
fi

cat > "$META_FILE" <<EOF
CLIENT_NAME=${CLIENT_NAME}
CLIENT_PUBLIC_KEY=${CLIENT_PUB}
CLIENT_IP=${CLIENT_IP}
EOF
chmod 0600 "$META_FILE"
rm -f "$BACKUP_SERVER"

printf 'Peer eklendi: %s -> %s\n' "$CLIENT_NAME" "$CLIENT_IP"
printf 'Istemci config: %s (sahip: %s, izin: 0600)\n' "$OUT" "$CALLING_USER"
printf 'Dosyayi cihaza kopyaladiktan sonra bu sunucu kopyasini silin.\n'
