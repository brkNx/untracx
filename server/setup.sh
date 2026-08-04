#!/usr/bin/env bash
# untracx — Oracle Cloud Always Free (ARM) WireGuard sunucu kurulumu
# Ubuntu 22.04/24.04 ARM üzerinde root olarak çalıştırın:  sudo bash setup.sh
#
# Varsayılanlar (env ile ezilebilir):
#   WG_PORT, WG_SUBNET, WG_SERVER_IP, WG_DNS, WG_CLIENT_IP
set -euo pipefail

WG_PORT="${WG_PORT:-51820}"
WG_SUBNET="${WG_SUBNET:-10.66.66.0/24}"
WG_SERVER_IP="${WG_SERVER_IP:-10.66.66.1}"
WG_DNS="${WG_DNS:-10.66.66.1}"
WG_CLIENT_IP="${WG_CLIENT_IP:-10.66.66.2}"
WG_IFACE="${WG_IFACE:-wg0}"
WG_CONF="/etc/wireguard/${WG_IFACE}.conf"

if [[ $EUID -ne 0 ]]; then
  echo "HATA: root olarak çalıştırın: sudo bash setup.sh" >&2
  exit 1
fi

echo "[1/6] Sistem paketleri güncelleniyor..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq wireguard wireguard-tools ufw fail2ban unattended-upgrades curl

echo "[2/6] Çekirdek yönlendirme etkinleştiriliyor..."
cat > /etc/sysctl.d/99-untracx.conf <<EOF
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
net.ipv6.conf.default.forwarding = 1
EOF
sysctl --system > /dev/null

echo "[3/6] Sunucu anahtarları üretiliyor (yoksa)..."
SERVER_PRIV="${WG_CONF%.conf}.private.key"
SERVER_PUB="${WG_CONF%.conf}.public.key"
if [[ ! -f "$SERVER_PRIV" ]]; then
  umask 077
  wg genkey > "$SERVER_PRIV"
  wg pubkey < "$SERVER_PRIV" > "$SERVER_PUB"
  chmod 600 "$SERVER_PRIV"
  echo "  Yeni sunucu anahtarları: ${WG_CONF%.conf}.*.key"
else
  echo "  Mevcut anahtarlar korundu."
fi

echo "[4/6] ${WG_CONF} yazılıyor..."
cat > "$WG_CONF" <<EOF
[Interface]
Address = ${WG_SERVER_IP}/24
ListenPort = ${WG_PORT}
PrivateKey = $(cat "$SERVER_PRIV")
PostUp = iptables -A FORWARD -i ${WG_IFACE} -j ACCEPT; iptables -A FORWARD -o ${WG_IFACE} -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE; ip6tables -A FORWARD -i ${WG_IFACE} -j ACCEPT; ip6tables -A FORWARD -o ${WG_IFACE} -j ACCEPT; ip6tables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i ${WG_IFACE} -j ACCEPT; iptables -D FORWARD -o ${WG_IFACE} -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE; ip6tables -D FORWARD -i ${WG_IFACE} -j ACCEPT; ip6tables -D FORWARD -o ${WG_IFACE} -j ACCEPT; ip6tables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
EOF
chmod 600 "$WG_CONF"

echo "[5/6] Güvenlik duvarı (ufw)..."
ufw default deny incoming > /dev/null
ufw default allow outgoing > /dev/null
ufw allow OpenSSH > /dev/null
ufw allow "${WG_PORT}/udp" > /dev/null
ufw --force enable > /dev/null

echo "[6/6] Servis başlatılıyor + otomatik güncellemeler..."
systemctl enable wg-quick@${WG_IFACE} > /dev/null 2>&1
systemctl restart wg-quick@${WG_IFACE}
dpkg-reconfigure -f noninteractive unattended-upgrades > /dev/null 2>&1 || true

echo
echo "================== KURULUM TAMAM =================="
echo "Sunucu PublicKey : $(cat "$SERVER_PUB")"
echo "Sunucu IP        : $(curl -4 -s https://api.ipify.org || curl -4 -s https://ifconfig.me)"
echo "Port             : ${WG_PORT}/udp"
echo "Alt ağ           : ${WG_SUBNET}"
echo
echo "İstemci eklemek için:  sudo bash add-peer.sh <cihaz-adi>"
echo "Örnek:               sudo bash add-peer.sh macbook"
echo "==================================================="
