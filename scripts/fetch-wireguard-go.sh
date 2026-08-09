#!/usr/bin/env bash
# untracx — wireguard-go kullanıcı alanı binary'sini kurar
# (wg-quick/kernel modülü olmayan sistemler için: Windows, macOS)
set -euo pipefail

if ! command -v go >/dev/null 2>&1; then
  echo "HATA: Go kurulu değil. https://go.dev/dl adresinden kurun." >&2
  exit 1
fi

GOBIN_DIR="$(go env GOPATH)/bin"
echo "[1/1] wireguard-go derleniyor → ${GOBIN_DIR}"
# Sabit sürüm: @latest yerine bilinen iyi bir sürüm (tedarik zinciri güvenliği).
go install golang.zx2c4.com/wireguard/cmd/wireguard-go@v0.0.20230227

echo "✓ Kuruldu: ${GOBIN_DIR}/wireguard-go"
echo "  PATH'e ekleyin veya scripti bundle'a gömün."
