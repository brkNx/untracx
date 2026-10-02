#!/usr/bin/env bash
# untracx - Ubuntu 24.04 WireGuard server bootstrap for OCI (x86_64 or arm64)
# Run from the uploaded server/ directory: sudo PUBLIC_ENDPOINT=x.x.x.x bash setup.sh
set -Eeuo pipefail

umask 077

WG_PORT="${WG_PORT:-51820}"
WG_SUBNET="${WG_SUBNET:-10.66.66.0/24}"
WG_SERVER_IP="${WG_SERVER_IP:-10.66.66.1}"
WG_DNS="${WG_DNS:-10.66.66.1}"
WG_IFACE="${WG_IFACE:-wg0}"
PUBLIC_ENDPOINT="${PUBLIC_ENDPOINT:-}"
SSH_PORT="${SSH_PORT:-}"
WG_MTU="${WG_MTU:-1420}"

WG_DIR="/etc/wireguard"
WG_CONF="${WG_DIR}/${WG_IFACE}.conf"
SERVER_PRIV="${WG_DIR}/${WG_IFACE}.private.key"
SERVER_PUB="${WG_DIR}/${WG_IFACE}.public.key"
UNTRACX_DIR="/etc/untracx"
SERVER_ENV="${UNTRACX_DIR}/server.env"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

log() {
  printf '[untracx] %s\n' "$*"
}

die() {
  printf '[untracx] ERROR: %s\n' "$*" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  printf '[untracx] ERROR: setup halted near line %s (exit code %s).\n' "${BASH_LINENO[0]:-?}" "$exit_code" >&2
  exit "$exit_code"
}
trap on_error ERR

validate_port() {
  [[ "$1" =~ ^[0-9]+$ ]] && (( 1 <= 10#$1 && 10#$1 <= 65535 ))
}

validate_ipv4() {
  local value=$1 octet
  local -a octets
  IFS='.' read -r -a octets <<< "$value"
  [[ ${#octets[@]} -eq 4 ]] || return 1
  for octet in "${octets[@]}"; do
    [[ "$octet" =~ ^[0-9]{1,3}$ ]] || return 1
    (( 10#$octet <= 255 )) || return 1
  done
}

validate_endpoint() {
  validate_ipv4 "$1" || [[ "$1" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$ ]]
}

if [[ $EUID -ne 0 ]]; then
  die "run as root: sudo PUBLIC_ENDPOINT=<public-ip> bash setup.sh"
fi

[[ -r /etc/os-release ]] || die "/etc/os-release not found"
# shellcheck disable=SC1091
. /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || die "this release is only verified for Ubuntu (found: ${ID:-unknown})"
[[ "${VERSION_ID:-}" == "24.04" || "${VERSION_ID:-}" == "22.04" ]] || die "Ubuntu 22.04/24.04 required (found: ${VERSION_ID:-unknown})"

[[ "$WG_IFACE" =~ ^[A-Za-z0-9_=+.-]{1,15}$ ]] || die "invalid WG_IFACE: $WG_IFACE"
validate_port "$WG_PORT" || die "invalid WG_PORT: $WG_PORT"
if ! [[ "$WG_MTU" =~ ^[0-9]+$ ]] || ! (( 576 <= 10#$WG_MTU && 10#$WG_MTU <= 1500 )); then
  die "invalid WG_MTU (576-1500): $WG_MTU"
fi

if [[ -z "$SSH_PORT" && -n "${SSH_CONNECTION:-}" ]]; then
  read -r _ _ _ SSH_PORT <<< "$SSH_CONNECTION"
fi
SSH_PORT="${SSH_PORT:-22}"
validate_port "$SSH_PORT" || die "invalid SSH_PORT: $SSH_PORT"

[[ "$WG_SUBNET" == */24 ]] || die "this MVP only supports /24 WG_SUBNET"
WG_NETWORK="${WG_SUBNET%/24}"
validate_ipv4 "$WG_NETWORK" || die "invalid WG_SUBNET: $WG_SUBNET"
[[ "${WG_NETWORK##*.}" == "0" ]] || die "WG_SUBNET /24 network address must end with .0"
validate_ipv4 "$WG_SERVER_IP" || die "invalid WG_SERVER_IP: $WG_SERVER_IP"
validate_ipv4 "$WG_DNS" || die "invalid WG_DNS: $WG_DNS"
WG_PREFIX="${WG_NETWORK%.*}"
[[ "$WG_SERVER_IP" == "${WG_PREFIX}."* ]] || die "WG_SERVER_IP must be inside WG_SUBNET"
WG_SERVER_HOST="${WG_SERVER_IP##*.}"
(( 1 <= 10#$WG_SERVER_HOST && 10#$WG_SERVER_HOST <= 254 )) || die "WG_SERVER_IP must be a usable host address"

for helper in add-peer.sh remove-peer.sh; do
  [[ -f "${SCRIPT_DIR}/${helper}" ]] || die "${helper} not found; please upload the complete server/ directory"
done

log "[1/8] Installing packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  ca-certificates curl fail2ban iproute2 iptables \
  unattended-upgrades ufw unbound util-linux wireguard wireguard-tools

if [[ -z "$PUBLIC_ENDPOINT" ]]; then
  PUBLIC_ENDPOINT="$(curl -4 --fail --silent --show-error --max-time 10 https://api.ipify.org)" || \
    die "public IP auto-detection failed; re-run with PUBLIC_ENDPOINT=<public-ip>"
fi
validate_endpoint "$PUBLIC_ENDPOINT" || die "invalid PUBLIC_ENDPOINT: $PUBLIC_ENDPOINT"

OUT_IFACE="$(ip -4 route show default | awk 'NR == 1 { print $5 }')"
[[ -n "$OUT_IFACE" ]] || die "default IPv4 egress interface not found"
[[ "$OUT_IFACE" =~ ^[A-Za-z0-9_.:-]{1,32}$ ]] || die "invalid egress interface name: $OUT_IFACE"
log "Egress interface: ${OUT_IFACE}; endpoint: ${PUBLIC_ENDPOINT}:${WG_PORT}"

log "[2/8] Configuring directories and forwarding..."
install -d -o root -g root -m 0700 "$WG_DIR" "$UNTRACX_DIR" /var/lib/untracx/peers
cat > /etc/sysctl.d/99-untracx.conf <<'EOF'
net.ipv4.ip_forward = 1
EOF
sysctl --system > /dev/null

log "[3/8] Preparing server cryptographic key..."
if [[ ! -s "$SERVER_PRIV" ]]; then
  wg genkey > "$SERVER_PRIV"
  chmod 0600 "$SERVER_PRIV"
  log "Generated new server private key."
else
  log "Preserved existing server private key."
fi
wg pubkey < "$SERVER_PRIV" > "$SERVER_PUB"
chmod 0600 "$SERVER_PUB"

log "[4/8] Generating WireGuard configuration..."
if [[ ! -e "$WG_CONF" ]]; then
  cat > "$WG_CONF" <<EOF
[Interface]
Address = ${WG_SERVER_IP}/24
ListenPort = ${WG_PORT}
MTU = ${WG_MTU}
PrivateKey = $(<"$SERVER_PRIV")

# Rules are limited to the VPN subnet and the detected egress interface.
PostUp = iptables -w -C FORWARD -i %i -o ${OUT_IFACE} -s ${WG_SUBNET} -j ACCEPT 2>/dev/null || iptables -w -I FORWARD 1 -i %i -o ${OUT_IFACE} -s ${WG_SUBNET} -j ACCEPT
PostUp = iptables -w -C FORWARD -i ${OUT_IFACE} -o %i -d ${WG_SUBNET} -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || iptables -w -I FORWARD 1 -i ${OUT_IFACE} -o %i -d ${WG_SUBNET} -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
PostUp = iptables -w -t nat -C POSTROUTING -s ${WG_SUBNET} -o ${OUT_IFACE} -j MASQUERADE 2>/dev/null || iptables -w -t nat -A POSTROUTING -s ${WG_SUBNET} -o ${OUT_IFACE} -j MASQUERADE
PostDown = iptables -w -D FORWARD -i %i -o ${OUT_IFACE} -s ${WG_SUBNET} -j ACCEPT 2>/dev/null || true
PostDown = iptables -w -D FORWARD -i ${OUT_IFACE} -o %i -d ${WG_SUBNET} -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true
PostDown = iptables -w -t nat -D POSTROUTING -s ${WG_SUBNET} -o ${OUT_IFACE} -j MASQUERADE 2>/dev/null || true
EOF
  chmod 0600 "$WG_CONF"
else
  log "Preserving existing ${WG_CONF} and configured peers."
  EXISTING_ADDRESS="$(awk -F= '/^[[:space:]]*Address[[:space:]]*=/ { gsub(/[[:space:]]/, "", $2); print $2; exit }' "$WG_CONF")"
  EXISTING_PORT="$(awk -F= '/^[[:space:]]*ListenPort[[:space:]]*=/ { gsub(/[[:space:]]/, "", $2); print $2; exit }' "$WG_CONF")"
  [[ "$EXISTING_ADDRESS" == "${WG_SERVER_IP}/24" ]] || \
    die "existing config has Address=${EXISTING_ADDRESS}; requested ${WG_SERVER_IP}/24. Aborting automatic overwrite."
  [[ "$EXISTING_PORT" == "$WG_PORT" ]] || \
    die "existing config has ListenPort=${EXISTING_PORT}; requested ${WG_PORT}. Aborting automatic overwrite."
fi

cat > "$SERVER_ENV" <<EOF
# Root-owned state used by untracx peer-management commands.
WG_IFACE=${WG_IFACE}
WG_SUBNET=${WG_SUBNET}
WG_SERVER_IP=${WG_SERVER_IP}
WG_DNS=${WG_DNS}
WG_PORT=${WG_PORT}
WG_MTU=${WG_MTU}
PUBLIC_ENDPOINT=${PUBLIC_ENDPOINT}
EOF
chmod 0600 "$SERVER_ENV"

log "[5/8] Configuring in-tunnel DNS resolver..."
if [[ "$WG_DNS" == "$WG_SERVER_IP" ]]; then
  cat > /etc/unbound/unbound.conf.d/untracx.conf <<EOF
server:
  interface: ${WG_SERVER_IP}
  port: 53
  ip-freebind: yes
  access-control: ${WG_SUBNET} allow
  access-control: 0.0.0.0/0 refuse
  do-ip4: yes
  do-ip6: no
  hide-identity: yes
  hide-version: yes
  qname-minimisation: yes
  harden-dnssec-stripped: yes
  prefetch: yes
EOF
  install -d -o root -g root -m 0755 /etc/systemd/system/unbound.service.d
  cat > /etc/systemd/system/unbound.service.d/untracx.conf <<EOF
[Unit]
After=wg-quick@${WG_IFACE}.service
Requires=wg-quick@${WG_IFACE}.service
EOF
  unbound-checkconf > /dev/null
else
  log "External WG_DNS specified; skipping local Unbound configuration."
  rm -f /etc/unbound/unbound.conf.d/untracx.conf /etc/systemd/system/unbound.service.d/untracx.conf
fi

log "[6/8] Configuring UFW, fail2ban, and unattended upgrades..."
ufw default deny incoming > /dev/null
ufw default allow outgoing > /dev/null
ufw default deny routed > /dev/null
ufw allow "${SSH_PORT}/tcp" comment 'untracx SSH' > /dev/null
ufw allow "${WG_PORT}/udp" comment 'untracx WireGuard' > /dev/null
ufw route allow in on "$WG_IFACE" out on "$OUT_IFACE" from "$WG_SUBNET" comment 'untracx VPN egress' > /dev/null
if [[ "$WG_DNS" == "$WG_SERVER_IP" ]]; then
  ufw allow in on "$WG_IFACE" to "$WG_SERVER_IP" port 53 proto udp comment 'untracx DNS UDP' > /dev/null
  ufw allow in on "$WG_IFACE" to "$WG_SERVER_IP" port 53 proto tcp comment 'untracx DNS TCP' > /dev/null
fi
ufw --force enable > /dev/null

cat > /etc/fail2ban/jail.d/untracx-sshd.local <<EOF
[sshd]
enabled = true
port = ${SSH_PORT}
banaction = ufw
EOF

cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

log "[7/8] Installing peer management utilities..."
install -o root -g root -m 0700 "${SCRIPT_DIR}/add-peer.sh" /usr/local/sbin/untracx-add-peer
install -o root -g root -m 0700 "${SCRIPT_DIR}/remove-peer.sh" /usr/local/sbin/untracx-remove-peer

log "[8/8] Starting and verifying services..."
systemctl daemon-reload
systemctl enable "wg-quick@${WG_IFACE}" fail2ban unattended-upgrades > /dev/null
systemctl restart "wg-quick@${WG_IFACE}"
systemctl restart fail2ban
if [[ "$WG_DNS" == "$WG_SERVER_IP" ]]; then
  systemctl enable unbound > /dev/null
  systemctl restart unbound
fi

systemctl is-active --quiet "wg-quick@${WG_IFACE}" || die "WireGuard service is not active"
wg show "$WG_IFACE" > /dev/null || die "WireGuard interface could not be read"
ss -H -lun | awk -v port=":${WG_PORT}" '$4 ~ port "$" { found=1 } END { exit !found }' || \
  die "UDP port ${WG_PORT} listener not found"
if [[ "$WG_DNS" == "$WG_SERVER_IP" ]]; then
  systemctl is-active --quiet unbound || die "Unbound service is not active"
fi

cat <<EOF

================== UNTRACX READY ==================
Server PublicKey : $(<"$SERVER_PUB")
Server Endpoint  : ${PUBLIC_ENDPOINT}:${WG_PORT}/udp
VPN Subnet       : ${WG_SUBNET}
VPN DNS          : ${WG_DNS}
Egress Interface : ${OUT_IFACE}

Next step:
  sudo untracx-add-peer <device-name>

OCI Console UDP ${WG_PORT} ingress rule must be open.
Status check:
  sudo wg show ${WG_IFACE}
===================================================
EOF
