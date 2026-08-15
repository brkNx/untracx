#!/usr/bin/env bash
# untracx - Peer Lifecycle & Transaction Fixture Test Suite
set -euo pipefail

TEST_DIR="$(mktemp -d "/tmp/untracx-peer-test.XXXXXX")"
cleanup() { rm -rf "$TEST_DIR"; }
trap cleanup EXIT

MOCK_CONF="${TEST_DIR}/wg0.conf"
MOCK_META="${TEST_DIR}/client1.env"

# Create test config with manual and managed peers
cat > "$MOCK_CONF" << 'WGCONF'
[Interface]
Address = 10.66.66.1/24
ListenPort = 51820
PrivateKey = SERVER_PRIV_KEY_AAAAAAAAAAAAAAAAAAAAAAAAAAA=

# manual-peer-1
[Peer]
PublicKey = MANUAL_PUB_KEY_111111111111111111111111111=
AllowedIPs = 10.66.66.10/32

# untracx-peer: client1
[Peer]
PublicKey = CLIENT1_PUB_KEY_AAAAAAAAAAAAAAAAAAAAAAAAAA=
PresharedKey = PSK_111111111111111111111111111111111111111=
AllowedIPs = 10.66.66.2/32

# untracx-peer: client2
[Peer]
PublicKey = CLIENT2_PUB_KEY_AAAAAAAAAAAAAAAAAAAAAAAAAA=
PresharedKey = PSK_222222222222222222222222222222222222222=
AllowedIPs = 10.66.66.3/32

# manual-peer-after
[Peer]
PublicKey = MANUAL_PUB_KEY_AFTER_222222222222222222222=
AllowedIPs = 10.66.66.20/32
WGCONF

cat > "$MOCK_META" << 'META'
CLIENT_NAME=client1
CLIENT_PUBLIC_KEY=CLIENT1_PUB_KEY_AAAAAAAAAAAAAAAAAAAAAAAAAA=
CLIENT_IP=10.66.66.2
PRESHARED_KEY=PSK_111111111111111111111111111111111111111=
META

# Execute remove peer parser for client1
TARGET_NAME="client1"
TARGET_PUB="CLIENT1_PUB_KEY_AAAAAAAAAAAAAAAAAAAAAAAAAA="

TMP_CONF="${TEST_DIR}/tmp.conf"
PARSER_OUT=$(awk -v target_pub="$TARGET_PUB" -v target_name="$TARGET_NAME" '
BEGIN { in_peer = 0; peer_block = ""; peer_marker = ""; removed_count = 0 }
function flush_peer() {
  if (in_peer) {
    is_target = 0
    if (peer_marker == "# untracx-peer: " target_name) is_target = 1
    if (target_pub != "" && peer_block ~ ("PublicKey[[:space:]]*=[[:space:]]*" target_pub)) is_target = 1
    if (is_target) removed_count++
    else {
      if (peer_marker != "") printf "%s\n", peer_marker
      printf "%s", peer_block
    }
  }
  in_peer = 0; peer_block = ""; peer_marker = ""
}
/^# untracx-peer: / { flush_peer(); peer_marker = $0; next }
/^\[Peer\]/ { flush_peer(); in_peer = 1; peer_block = $0 "\n"; next }
{
  if (in_peer) peer_block = peer_block $0 "\n"
  else {
    if (peer_marker != "") { printf "%s\n", peer_marker; peer_marker = "" }
    print $0
  }
}
END { flush_peer(); print "REMOVED=" removed_count > "/dev/stderr" }
' "$MOCK_CONF" 2>"${TEST_DIR}/meta_result")

printf '%s\n' "$PARSER_OUT" > "$TMP_CONF"

# Verification assertions
grep -q "MANUAL_PUB_KEY_111111111111111111111111111=" "$TMP_CONF" || { echo "FAIL: manual-peer-1 missing" >&2; exit 1; }
! grep -q "CLIENT1_PUB_KEY_AAAAAAAAAAAAAAAAAAAAAAAAAA=" "$TMP_CONF" || { echo "FAIL: client1 not removed" >&2; exit 1; }
grep -q "CLIENT2_PUB_KEY_AAAAAAAAAAAAAAAAAAAAAAAAAA=" "$TMP_CONF" || { echo "FAIL: client2 missing" >&2; exit 1; }
grep -q "MANUAL_PUB_KEY_AFTER_222222222222222222222=" "$TMP_CONF" || { echo "FAIL: manual-peer-after missing" >&2; exit 1; }

echo "PASS: All peer lifecycle fixture tests succeeded."
