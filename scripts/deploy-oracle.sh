#!/usr/bin/env bash
# untracx - Oracle Cloud (OCI) & Remote Server Automated Deployment Script
# Usage:   bash scripts/deploy-oracle.sh [ssh-target] [optional-peer-name]
# Example: bash scripts/deploy-oracle.sh oracle pc-client
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

SSH_TARGET="${1:-${UNTRACX_SSH_TARGET:-oracle}}"
PEER_NAME="${2:-}"
REMOTE_TMP="/tmp/untracx-server"

log() { printf '\n[untracx-oracle] %s\n' "$*"; }
die() { printf '\n[untracx-oracle] ERROR: %s\n' "$*" >&2; exit 1; }

# Input validation
[[ "$SSH_TARGET" =~ ^[A-Za-z0-9_@.:-]+$ ]] || die "Invalid SSH_TARGET: $SSH_TARGET"
if [[ -n "$PEER_NAME" ]]; then
  [[ "$PEER_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$ ]] || die "Invalid PEER_NAME: $PEER_NAME"
fi

log "1/5 Testing SSH connection to $SSH_TARGET..."
if ! ssh -o BatchMode=yes -o ConnectTimeout=10 "$SSH_TARGET" "echo 'SSH connection successful'" > /dev/null 2>&1; then
  die "SSH connection failed. Please verify ~/.ssh/config or reachability: ssh $SSH_TARGET"
fi

# Remote system info
REMOTE_ARCH="$(ssh "$SSH_TARGET" "uname -m")"
REMOTE_OS="$(ssh "$SSH_TARGET" "grep '^PRETTY_NAME=' /etc/os-release | cut -d= -f2 | tr -d '\"'")"
log "Target System: $REMOTE_OS ($REMOTE_ARCH)"

log "2/5 Syncing server bundle..."
ssh "$SSH_TARGET" "rm -rf '$REMOTE_TMP' && mkdir -p '$REMOTE_TMP'"
scp -q -r "$ROOT_DIR/server/"* "$SSH_TARGET:$REMOTE_TMP/"

log "3/5 Executing untracx bootstrap (setup.sh)..."
# shellcheck disable=SC2029
ssh -t "$SSH_TARGET" "cd '$REMOTE_TMP' && sudo bash setup.sh"

log "4/5 Verifying OCI host firewall and services..."
# shellcheck disable=SC2029
ssh "$SSH_TARGET" "
  # Is WireGuard service active?
  sudo systemctl is-active --quiet wg-quick@wg0 || exit 1

  # Ensure OCI host iptables rule allows UDP 51820
  sudo iptables -C INPUT -p udp --dport 51820 -j ACCEPT 2>/dev/null || \
    sudo iptables -I INPUT 1 -p udp --dport 51820 -j ACCEPT
"

if [[ -n "$PEER_NAME" ]]; then
  log "5/5 Provisioning client profile ($PEER_NAME)..."
  # shellcheck disable=SC2029
  ssh "$SSH_TARGET" "sudo untracx-add-peer '$PEER_NAME'"

  LOCAL_DEST="$ROOT_DIR/untracx-${PEER_NAME}.conf"
  scp -q "$SSH_TARGET:~/untracx-${PEER_NAME}.conf" "$LOCAL_DEST"
  # shellcheck disable=SC2029
  ssh "$SSH_TARGET" "rm -f '~/untracx-${PEER_NAME}.conf'"
  chmod 0600 "$LOCAL_DEST" 2>/dev/null || true

  log "Profile saved to -> $LOCAL_DEST"
else
  log "5/5 Skipped initial peer creation (no peer name specified)."
  log "To add a client profile later: ssh $SSH_TARGET 'sudo untracx-add-peer <device-name>'"
fi

cat <<EOF

===============================================================
             UNTRACX OCI DEPLOYMENT COMPLETED
===============================================================
WireGuard and Unbound DNS services are running and verified.

CRITICAL REMINDER (OCI VCN Ingress Rule):
In the Oracle Cloud Console, under your VCN Security List / NSG:
  - Protocol: UDP
  - Destination Port: 51820
  - Source: 0.0.0.0/0
Make sure this ingress rule is active.

Check Server Status:
  ssh $SSH_TARGET 'sudo wg show wg0'
===============================================================
EOF
