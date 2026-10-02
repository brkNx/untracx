#!/usr/bin/env bash
# untracx - Oracle Cloud (OCI) & Uzak Sunucu Otomatik Kurulum ve Dagitim Scripti
# Kullanim: bash scripts/deploy-oracle.sh [ssh-target] [opsiyonel-peer-adi]
# Ornek:    bash scripts/deploy-oracle.sh oracle pc-brk
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

SSH_TARGET="${1:-${UNTRACX_SSH_TARGET:-oracle}}"
PEER_NAME="${2:-}"
REMOTE_TMP="/tmp/untracx-server"

log() { printf '\n[untracx-oracle] %s\n' "$*"; }
die() { printf '\n[untracx-oracle] HATA: %s\n' "$*" >&2; exit 1; }

# Temel girdi dogrulamasi
[[ "$SSH_TARGET" =~ ^[A-Za-z0-9_@.:-]+$ ]] || die "Gecersiz SSH_TARGET: $SSH_TARGET"
if [[ -n "$PEER_NAME" ]]; then
  [[ "$PEER_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$ ]] || die "Gecersiz PEER_NAME: $PEER_NAME"
fi

log "1/5 SSH baglantisi test ediliyor ($SSH_TARGET)..."
if ! ssh -o BatchMode=yes -o ConnectTimeout=10 "$SSH_TARGET" "echo 'SSH baglantisi basarili'" > /dev/null 2>&1; then
  die "SSH baglantisi kurulamadi. Lutfen ~/.ssh/config veya erisimi kontrol edin: ssh $SSH_TARGET"
fi

# Uzak sistem bilgisi
REMOTE_ARCH="$(ssh "$SSH_TARGET" "uname -m")"
REMOTE_OS="$(ssh "$SSH_TARGET" "grep '^PRETTY_NAME=' /etc/os-release | cut -d= -f2 | tr -d '\"'")"
log "Hedef Sistem: $REMOTE_OS ($REMOTE_ARCH)"

log "2/5 Sunucu bilesenleri aktariliyor..."
ssh "$SSH_TARGET" "rm -rf '$REMOTE_TMP' && mkdir -p '$REMOTE_TMP'"
scp -q -r "$ROOT_DIR/server/"* "$SSH_TARGET:$REMOTE_TMP/"

log "3/5 Untracx bootstrap (setup.sh) calistiriliyor..."
# shellcheck disable=SC2029
ssh -t "$SSH_TARGET" "cd '$REMOTE_TMP' && sudo bash setup.sh"

log "4/5 OCI iptables ve servis durumlari dogrulaniyor..."
# shellcheck disable=SC2029
ssh "$SSH_TARGET" "
  # Wireguard servisi aktif mi?
  sudo systemctl is-active --quiet wg-quick@wg0 || exit 1

  # OCI host iptables kurali (UFW uzerine garanti ek guvenlik)
  sudo iptables -C INPUT -p udp --dport 51820 -j ACCEPT 2>/dev/null || \
    sudo iptables -I INPUT 1 -p udp --dport 51820 -j ACCEPT
"

if [[ -n "$PEER_NAME" ]]; then
  log "5/5 Cihaz profili olusturuluyor ($PEER_NAME)..."
  # shellcheck disable=SC2029
  ssh "$SSH_TARGET" "sudo untracx-add-peer '$PEER_NAME'"

  LOCAL_DEST="$ROOT_DIR/untracx-${PEER_NAME}.conf"
  scp -q "$SSH_TARGET:~/untracx-${PEER_NAME}.conf" "$LOCAL_DEST"
  # shellcheck disable=SC2029
  ssh "$SSH_TARGET" "rm -f '~/untracx-${PEER_NAME}.conf'"
  chmod 0600 "$LOCAL_DEST" 2>/dev/null || true

  log "Profil basariyla indirildi -> $LOCAL_DEST"
else
  log "5/5 Ilk peer olusturma adimi atlandi (peer adi belirtilmedi)."
  log "Yeni bir cihaz eklemek icin calistirin: ssh $SSH_TARGET 'sudo untracx-add-peer <cihaz-adi>'"
fi

cat <<EOF

===============================================================
           UNTRACX ORACLE CLOUD KURULUMU TAMAMLANDI
===============================================================
Sunucu WireGuard ve Unbound DNS servisleri hazir ve calisiyor.

ONEMLI HATIRLATMA (OCI VCN Ingress Kurali):
Oracle Cloud Web Konsolu'nda VCN Security List veya NSG uzerinde:
  - Protokol: UDP
  - Hedef Port: 51820
  - Kaynak: 0.0.0.0/0
kuralinin ekli oldugundan emin olun.

Sunucu Durumu:
  ssh $SSH_TARGET 'sudo wg show wg0'
===============================================================
EOF
