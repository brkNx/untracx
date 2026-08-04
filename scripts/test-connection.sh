#!/usr/bin/env bash
# untracx - gercek cihaz baglanti testi (istemci tarafinda calistirilir)
# Kullanim: bash scripts/test-connection.sh [peer-adi]
# Varsayilanlar: UNTRACX_SERVER=158.180.50.114, UNTRACX_SSH_USER=ubuntu
# Gereksinimler: ssh/scp, sudo (sunucuda ve yerelde), WireGuard.app veya wireguard-tools
set -Eeuo pipefail

SERVER="${UNTRACX_SERVER:-158.180.50.114}"
SSH_USER="${UNTRACX_SSH_USER:-ubuntu}"
PEER_NAME="${1:-macbook}"
CONF_FILE="untracx-${PEER_NAME}.conf"
LOCAL_CONF="/tmp/${CONF_FILE}"

log() { printf '\n[untracx-test] %s\n' "$*"; }
die() { printf '\n[untracx-test] HATA: %s\n' "$*" >&2; exit 1; }

log "Sunucu: ${SERVER} | Peer: ${PEER_NAME}"

# 1) Sunucuda peer olustur (sudo sifresini terminale yazin)
log "Peer olusturuluyor (sunucu ve sudo sifresi istenebilir)"
ssh -t "$SSH_USER@$SERVER" "sudo untracx-add-peer ${PEER_NAME}"

# 2) Config dosyasini cek, sunucudaki gecici kopyayi sil
log "Config indiriliyor: ${LOCAL_CONF}"
scp -q "$SSH_USER@$SERVER":"~/${CONF_FILE}" "$LOCAL_CONF"
chmod 600 "$LOCAL_CONF"
ssh -t "$SSH_USER@$SERVER" "rm -f ~/${CONF_FILE}"

# 3) Tüneli ac
WG_TOOLS=""
command -v wg-quick >/dev/null 2>&1 && WG_TOOLS=yes
if [[ -z "$WG_TOOLS" ]] && command -v brew >/dev/null 2>&1; then
  log "wireguard-tools kuruluyor (brew)"
  brew install wireguard-tools
  command -v wg-quick >/dev/null 2>&1 && WG_TOOLS=yes
fi

if [[ -n "$WG_TOOLS" ]] && [[ -d /Applications/WireGuard.app ]]; then
  log "Tünel wg-quick ile aciliyor"
  sudo wg-quick up "$LOCAL_CONF"
else
  log "Otomatik tünel acilamadi. Asagidakileri yapin:"
  log "  1) WireGuard uygulamasini acin -> Import tunnel from file"
  log "  2) Dosya: ${LOCAL_CONF}"
  log "  3) Tüneli acin (toggle)"
  log "  4) Asagidaki yonlendirme DNS testinde yerel DNS gorunur."
  read -r -p "Tünel acildiginda Enter'a basin... " _
fi

EXPECTED_IP="$SERVER"

# 4) EGRESS (IPv4) testi
log "1/3 EGRESS (IPv4) testi"
ACTUAL_IP="$(curl -4 --max-time 10 --fail --silent https://api.ipify.org)"
if [[ "$ACTUAL_IP" == "$EXPECTED_IP" ]]; then
  echo "PASS: trafik tünelden cikiyor -> ${ACTUAL_IP}"
else
  die "ikel? beklendigi gibi ${EXPECTED_IP} degil; gorulen: ${ACTUAL_IP}"
fi

# 5) DNS testi (VPN-ici resolver)
log "2/3 DNS testi (10.66.66.1)"
if dig +time=3 +tries=1 +short @10.66.66.1 google.com | grep -q .; then
  echo "PASS: VPN DNS cozumleme calisiyor"
else
  echo "FAIL: 10.66.66.1 cozumleme cevap vermedi"
fi
DNS_IP="$(dig +time=3 +tries=1 +short TXT @10.66.66.1 o-o.myaddr.l.google.com | tr -d '"' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
if [[ -n "$DNS_IP" && "$DNS_IP" == "$EXPECTED_IP" ]]; then
  echo "PASS: DNS sorgulari da tünelden cikiyor (cilis IP: ${DNS_IP})"
elif [[ -n "$DNS_IP" ]]; then
  echo "UYARI: DNS cevabi sunucu IP'si degil (${DNS_IP}); leak olabilir"
else
  echo "NOT: DNS cikis IP'si alinamadi"
fi

# 6) HANDSHAKE testi (sunucu tarafinda)
log "3/3 HANDSHAKE testi (sunucu)"
PRIV="$(sed -n 's/^PrivateKey = //p' "$LOCAL_CONF" | head -1)"
CLIENT_PUB="$(printf '%s\n' "$PRIV" | wg pubkey)"
HANDSHAKE="$(ssh -t "$SSH_USER@$SERVER" "sudo wg show wg0" | tr -d '\r' | grep -A4 "peer: ${CLIENT_PUB}")"
if grep -q 'seconds ago' <<< "$HANDSHAKE"; then
  echo "PASS: aktif handshake gorunuyor"
  echo "$HANDSHAKE" | grep -E 'peer:|endpoint:|allowed ips:|latest handshake:|transfer:'
else
  echo "FAIL: handshake gorunmuyor"
  echo "$HANDSHAKE" || true
fi

log "Bitti. Tüneli kapatmak icin: sudo wg-quick down untracx-${PEER_NAME}"
log "Gecici config private key icerir; test bitince silin: rm -f ${LOCAL_CONF}"