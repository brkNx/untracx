#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_DIR="${REPO_ROOT}/core"
DIST_DIR="${REPO_ROOT}/dist"

log() {
  printf '[untracx-sign] %s\n' "$*"
}

die() {
  printf '[untracx-sign] HATA: %s\n' "$*" >&2
  exit 1
}

sign_binary() {
  local binary="$1"
  local output="$2"

  if command -v osslsigncode > /dev/null 2>&1 && [[ -n "${SIGNING_CERT_PKCS12:-}" ]]; then
    log "Imzaliyor (osslsigncode): ${binary}"
    osslsigncode sign \
      -pkcs12 "${SIGNING_CERT_PKCS12}" \
      -pass "${SIGNING_CERT_PASS:-}" \
      -in "${binary}" \
      -out "${output}" \
      -t http://timestamp.digicert.com \
      || die "osslsigncode ile imzalama basarisiz: ${binary}"
  elif command -v codesign > /dev/null 2>&1 && [[ "$(uname -s)" == "Darwin" ]]; then
    log "Imzaliyor (codesign, macOS): ${binary}"
    if [[ -n "${CODESIGN_IDENTITY:-}" ]]; then
      codesign --sign "${CODESIGN_IDENTITY}" --force "${binary}" || die "codesign basarisiz"
    else
      log "CODESIGN_IDENTITY bos; imzasiiz kopyalaniyor"
    fi
    cp "${binary}" "${output}"
  else
    log "Imzalama araci/sertifika bulunamadi; imzasiz kopyalaniyor"
    cp "${binary}" "${output}"
  fi
}

build_and_sign() {
  local target="$1"
  local output_name="$2"

  log "Building for ${target}..."
  cargo build \
    --manifest-path "${CORE_DIR}/Cargo.toml" \
    --target "${target}" \
    --release 2>&1

  local binary="${CORE_DIR}/target/${target}/release/untracx"
  [[ -f "${binary}" ]] || die "Binary bulunamadi: ${binary}"

  sign_binary "${binary}" "${DIST_DIR}/${output_name}"
  log "Signed binary: ${DIST_DIR}/${output_name}"
}

main() {
  mkdir -p "${DIST_DIR}"

  case "$(uname -s)" in
    Linux)
      build_and_sign "x86_64-unknown-linux-gnu" "untracx-linux-x86_64"
      build_and_sign "aarch64-unknown-linux-gnu" "untracx-linux-arm64"
      ;;
    Darwin)
      build_and_sign "x86_64-apple-darwin" "untracx-macos-x86_64"
      build_and_sign "aarch64-apple-darwin" "untracx-macos-arm64"
      ;;
    MINGW*|MSYS*|CYGWIN*)
      build_and_sign "x86_64-pc-windows-msvc" "untracx-windows-x86_64.exe"
      ;;
    *)
      die "Desteklenmeyen platform: $(uname -s)"
      ;;
  esac

  log "Tum imzali paketler ${DIST_DIR}/ klasorunde:"
  ls -la "${DIST_DIR}/"
}

main "$@"