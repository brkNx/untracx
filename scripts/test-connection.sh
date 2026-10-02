#!/usr/bin/env bash
# untracx - Live device connection and security verification test
# Usage: bash scripts/test-connection.sh [peer-name]
# Required environment variable: UNTRACX_SERVER (e.g., export UNTRACX_SERVER=1.2.3.4)
set -Eeuo pipefail

SERVER="${UNTRACX_SERVER:?'UNTRACX_SERVER not set (e.g., export UNTRACX_SERVER=1.2.3.4)'}"
SSH_USER="${UNTRACX_SSH_USER:-ubuntu}"
PEER_NAME="${1:-testclient}"
IFACE="${UNTRACX_IFACE:-wg0}"

# Strict input validation to prevent remote injection
[[ "$SERVER" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ || "$SERVER" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$ ]] || {
  echo "ERROR: Invalid SERVER address" >&2
  exit 1
}
[[ "$SSH_USER" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || {
  echo "ERROR: Invalid SSH_USER" >&2
  exit 1
}
[[ "$PEER_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$ ]] || {
  echo "ERROR: Invalid PEER_NAME" >&2
  exit 1
}
[[ "$IFACE" =~ ^[A-Za-z0-9_=+.-]{1,15}$ ]] || {
  echo "ERROR: Invalid IFACE" >&2
  exit 1
}

CONF_FILE="untracx-${PEER_NAME}.conf"
LOCAL_CONF="$(mktemp "/tmp/${CONF_FILE}.XXXXXX")"
TUNNEL_UP=0
TEST_FAILED=0

log() { printf '\n[untracx-test] %s\n' "$*"; }
die() { printf '\n[untracx-test] ERROR: %s\n' "$*" >&2; TEST_FAILED=1; exit 1; }

cleanup() {
  log "Cleaning up test resources..."
  if [[ "$TUNNEL_UP" -eq 1 ]]; then
    sudo wg-quick down "$LOCAL_CONF" 2>/dev/null || true
  fi
  rm -f "$LOCAL_CONF"
  # shellcheck disable=SC2029
  ssh "$SSH_USER@$SERVER" "rm -f ~/'$CONF_FILE'" 2>/dev/null || true
  # shellcheck disable=SC2029
  ssh "$SSH_USER@$SERVER" "sudo untracx-remove-peer '$PEER_NAME'" 2>/dev/null || true
  if [[ "$TEST_FAILED" -ne 0 ]]; then
    log "TEST FAILED (exit 1)"
    exit 1
  fi
}
trap cleanup EXIT INT TERM

log "Server: ${SERVER} | Peer: ${PEER_NAME} | Interface: ${IFACE}"

# 1) Create peer on server
log "1/5 Provisioning peer on server..."
# shellcheck disable=SC2029
ssh "$SSH_USER@$SERVER" "sudo untracx-add-peer '$PEER_NAME'"

# 2) Fetch configuration securely and clean up remote copy
log "2/5 Downloading client configuration..."
scp -q "$SSH_USER@$SERVER":"~/${CONF_FILE}" "$LOCAL_CONF"
chmod 0600 "$LOCAL_CONF"
# shellcheck disable=SC2029
ssh "$SSH_USER@$SERVER" "rm -f ~/'$CONF_FILE'"

# 3) Bring up local tunnel
log "3/5 Activating tunnel..."
if command -v wg-quick >/dev/null 2>&1; then
  sudo wg-quick up "$LOCAL_CONF"
  TUNNEL_UP=1
else
  die "wg-quick not found on local system"
fi

# 4) Egress IPv4 match test
log "4/5 Verifying IPv4 egress..."
ACTUAL_IP=""
for _ in {1..5}; do
  ACTUAL_IP="$(curl -4 --max-time 6 --fail --silent https://api.ipify.org || true)"
  [[ -n "$ACTUAL_IP" ]] && break
  sleep 1
done

if [[ "$ACTUAL_IP" == "$SERVER" ]]; then
  echo "PASS: Egress IP matches VPN server -> ${ACTUAL_IP}"
else
  echo "FAIL: Expected ${SERVER}, observed: ${ACTUAL_IP}" >&2
  TEST_FAILED=1
fi

# 5) In-tunnel recursive DNS test
log "5/5 Verifying internal DNS (10.66.66.1)..."
if command -v dig >/dev/null 2>&1; then
  if dig +time=3 +tries=2 +short @10.66.66.1 google.com >/dev/null 2>&1; then
    echo "PASS: VPN DNS resolution (10.66.66.1) successful"
  else
    echo "FAIL: 10.66.66.1 DNS did not respond" >&2
    TEST_FAILED=1
  fi
fi

# 6) Handshake epoch check
log "Verifying handshake timestamp..."
CLIENT_PUB="$(sed -n 's/^PublicKey = //p' "$LOCAL_CONF" | head -1)"
# shellcheck disable=SC2029
LATEST_HS="$(ssh "$SSH_USER@$SERVER" "sudo wg show '$IFACE' latest-handshakes" | awk -v pub="$CLIENT_PUB" '$1 == pub { print $2 }' || true)"
NOW="$(date +%s)"
if [[ -n "$LATEST_HS" && "$LATEST_HS" =~ ^[0-9]+$ ]] && (( NOW - LATEST_HS < 120 )); then
  echo "PASS: Fresh numeric handshake verified ($((NOW - LATEST_HS))s ago)"
else
  echo "WARNING: Handshake timestamp missing or stale ($LATEST_HS)"
fi

if [[ "$TEST_FAILED" -eq 0 ]]; then
  log "ALL TESTS PASSED (PASS)"
fi
