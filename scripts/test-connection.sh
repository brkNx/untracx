#!/usr/bin/env bash
# untracx - gercek cihaz baglanti ve guvenlik dogrulama testi
# Kullanim: bash scripts/test-connection.sh [peer-adi]
# Zorunlu ortam degiskeni: UNTRACX_SERVER (ornegin: export UNTRACX_SERVER=1.2.3.4)
set -Eeuo pipefail

SERVER="${UNTRACX_SERVER:?'UNTRACX_SERVER ayarlanmadi (ornegin: export UNTRACX_SERVER=1.2.3.4)'}"
SSH_USER="${UNTRACX_SSH_USER:-ubuntu}"
PEER_NAME="${1:-testclient}"
IFACE="${UNTRACX_IFACE:-wg0}"

# Strict input validation to prevent remote injection
[[ "$SERVER" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ || "$SERVER" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$ ]] || {
  echo "HATA: Gecersiz SERVER adresi" >&2
  exit 1
}
[[ "$SSH_USER" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || {
  echo "HATA: Gecersiz SSH_USER" >&2
  exit 1
}
[[ "$PEER_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$ ]] || {
  echo "HATA: Gecersiz PEER_NAME" >&2
  exit 1
}
[[ "$IFACE" =~ ^[A-Za-z0-9_=+.-]{1,15}$ ]] || {
  echo "HATA: Gecersiz IFACE" >&2
  exit 1
}

CONF_FILE="untracx-${PEER_NAME}.conf"
LOCAL_CONF="$(mktemp "/tmp/${CONF_FILE}.XXXXXX")"
TUNNEL_UP=0
TEST_FAILED=0

log() { printf '\n[untracx-test] %s\n' "$*"; }
die() { printf '\n[untracx-test] HATA: %s\n' "$*" >&2; TEST_FAILED=1; exit 1; }

cleanup() {
  log "Temizlik yapiliyor..."
  if [[ "$TUNNEL_UP" -eq 1 ]]; then
    sudo wg-quick down "$LOCAL_CONF" 2>/dev/null || true
  fi
  rm -f "$LOCAL_CONF"
  # shellcheck disable=SC2029
  ssh "$SSH_USER@$SERVER" "rm -f ~/'$CONF_FILE'" 2>/dev/null || true
  # shellcheck disable=SC2029
  ssh "$SSH_USER@$SERVER" "sudo untracx-remove-peer '$PEER_NAME'" 2>/dev/null || true
  if [[ "$TEST_FAILED" -ne 0 ]]; then
    log "TEST BASARISIZ (exit 1)"
    exit 1
  fi
}
trap cleanup EXIT INT TERM

log "Sunucu: ${SERVER} | Peer: ${PEER_NAME} | Arayuz: ${IFACE}"

# 1) Sunucuda peer olustur
log "1/5 Sunucuda peer olusturuluyor..."
# shellcheck disable=SC2029
ssh "$SSH_USER@$SERVER" "sudo untracx-add-peer '$PEER_NAME'"

# 2) Config dosyasini indir ve sunucudaki kopyayi sil
log "2/5 Config guvenli sekilde cekiliyor..."
scp -q "$SSH_USER@$SERVER":"~/${CONF_FILE}" "$LOCAL_CONF"
chmod 0600 "$LOCAL_CONF"
# shellcheck disable=SC2029
ssh "$SSH_USER@$SERVER" "rm -f ~/'$CONF_FILE'"

# 3) Tuneli ac
log "3/5 Tunel aciliyor..."
if command -v wg-quick >/dev/null 2>&1; then
  sudo wg-quick up "$LOCAL_CONF"
  TUNNEL_UP=1
else
  die "Yerel sistemde wg-quick bulunamadi"
fi

# 4) EGRESS (IPv4) testi
log "4/5 EGRESS (IPv4) testi yapiliyor..."
ACTUAL_IP=""
for _ in {1..5}; do
  ACTUAL_IP="$(curl -4 --max-time 6 --fail --silent https://api.ipify.org || true)"
  [[ -n "$ACTUAL_IP" ]] && break
  sleep 1
done

if [[ "$ACTUAL_IP" == "$SERVER" ]]; then
  echo "PASS: Cikis IP'si sunucu ile eslesiyor -> ${ACTUAL_IP}"
else
  echo "FAIL: Beklenen ${SERVER}, gorulen: ${ACTUAL_IP}" >&2
  TEST_FAILED=1
fi

# 5) DNS testi (VPN-ici resolver)
log "5/5 DNS testi (10.66.66.1)..."
if command -v dig >/dev/null 2>&1; then
  if dig +time=3 +tries=2 +short @10.66.66.1 google.com >/dev/null 2>&1; then
    echo "PASS: VPN DNS cozumleme (10.66.66.1) basarili"
  else
    echo "FAIL: 10.66.66.1 DNS cevap vermedi" >&2
    TEST_FAILED=1
  fi
fi

# 6) Handshake epoch testi
log "Handshake dogrulamasi yapiliyor..."
CLIENT_PUB="$(sed -n 's/^PublicKey = //p' "$LOCAL_CONF" | head -1)"
# shellcheck disable=SC2029
LATEST_HS="$(ssh "$SSH_USER@$SERVER" "sudo wg show '$IFACE' latest-handshakes" | awk -v pub="$CLIENT_PUB" '$1 == pub { print $2 }' || true)"
NOW="$(date +%s)"
if [[ -n "$LATEST_HS" && "$LATEST_HS" =~ ^[0-9]+$ ]] && (( NOW - LATEST_HS < 120 )); then
  echo "PASS: Guncel numeric handshake dogrulandi ($((NOW - LATEST_HS))s once)"
else
  echo "UYARI: Handshake zamani alinamadi veya eski ($LATEST_HS)"
fi

if [[ "$TEST_FAILED" -eq 0 ]]; then
  log "TUM TESTLER BASARILI (PASS)"
fi
