#!/usr/bin/env bash
# untracx — Yeni istemci (peer) ekleme
# Kullanım:  sudo bash add-peer.sh <cihaz-adi>   (ör. macbook, android, win-laptop)
# Çıktı:     /root/untracx-<cihaz-adi>.conf  (güvenli şekilde cihaza kopyalayın, sonra silin)
set -euo pipefail

CLIENT_NAME="${1:?Kullanım: sudo bash add-peer.sh <cihaz-adi>}"
WG_IFACE="${WG_IFACE:-wg0}"
WG_CONF="/etc/wireguard/${WG_IFACE}.conf"
WG_SUBNET="${WG_SUBNET:-10.66.66.0/24}"
WG_DNS="${WG_DNS:-10.66.66.1}"
WG_PORT="${WG_PORT:-51820}"
OUT="/root/untracx-${CLIENT_NAME}.conf"

if [[ $EUID -ne 0 ]]; then
  echo "HATA: root olarak çalıştırın: sudo bash add-peer.sh <cihaz-adi>" >&2
  exit 1
fi

# Kullanılmamış ilk istemci IP'sini bul (x.x.x.2'den başlar)
SERVER_IP=$(awk '/^Address = /{split($3,a,"/"); print a[1]}' "$WG_CONF")
SUBNET_PREFIX=$(echo "$WG_SUBNET" | cut -d. -f1-3)
NEXT=2
while wg show "$WG_IFACE" peers 2>/dev/null | grep -q .; do
  if [[ $(wg show "$WG_IFACE" allowed-ips) != *"${SUBNET_PREFIX}.${NEXT}"* ]]; then
    break
  fi
  NEXT=$((NEXT + 1))
done
CLIENT_IP="${SUBNET_PREFIX}.${NEXT}"

CLIENT_PRIV=$(wg genkey)
CLIENT_PUB=$(wg pubkey <<< "$CLIENT_PRIV")
SERVER_PUB=$(cat "${WG_CONF%.conf}.public.key")

# Sunucuya peer ekle (PersistentKeepalive: NAT arkası için kritik)
wg set "$WG_IFACE" peer "$CLIENT_PUB" allowed-ips "${CLIENT_IP}/32" persistent-keepalive 25
wg-quick save "$WG_IFACE" > /dev/null

umask 077
cat > "$OUT" <<EOF
[Interface]
PrivateKey = ${CLIENT_PRIV}
Address = ${CLIENT_IP}/32
DNS = ${WG_DNS}
MTU = 1420

[Peer]
PublicKey = ${SERVER_PUB}
Endpoint = $(curl -4 -s https://api.ipify.org || curl -4 -s https://ifconfig.me):${WG_PORT}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
EOF

chmod 600 "$OUT"
echo "✓ İstemci eklendi: ${CLIENT_NAME} → ${CLIENT_IP}"
echo "  İstemci config:  ${OUT}"
echo "  scp ${OUT} yereldekiuser@senin-mac.local:~/" 
echo "  SONRA: rm ${OUT}  (anahtarı sunucuda tutmayın)"
