#!/usr/bin/env bash
# untracx — installs wireguard-go userspace binary
# (for systems without native kernel WireGuard or wg-quick: Windows, macOS)
set -euo pipefail

if ! command -v go >/dev/null 2>&1; then
  echo "ERROR: Go is not installed. Install Go from https://go.dev/dl" >&2
  exit 1
fi

GOBIN_DIR="$(go env GOPATH)/bin"
echo "[1/1] Compiling wireguard-go → ${GOBIN_DIR}"
# Pinned version for reproducible supply-chain security
go install golang.zx2c4.com/wireguard/cmd/wireguard-go@v0.0.20230227

echo "✓ Installed: ${GOBIN_DIR}/wireguard-go"
echo "  Add to your PATH or bundle into distribution."
