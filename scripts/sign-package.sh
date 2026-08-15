#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_DIR="${REPO_ROOT}/core"
DIST_DIR="${REPO_ROOT}/dist"
ALLOW_UNSIGNED="${ALLOW_UNSIGNED:-0}"

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
      -ts https://timestamp.digicert.com \
      || die "osslsigncode ile imzalama basarisiz: ${binary}"
  elif command -v codesign > /dev/null 2>&1 && [[ "$(uname -s)" == "Darwin" ]]; then
    log "Imzaliyor (codesign, macOS): ${binary}"
    if [[ -n "${CODESIGN_IDENTITY:-}" ]]; then
      codesign --sign "${CODESIGN_IDENTITY}" --options runtime --force "${binary}" || die "codesign basarisiz"
      cp "${binary}" "${output}"
    elif [[ "$ALLOW_UNSIGNED" == "1" ]]; then
      log "CODESIGN_IDENTITY bos; ALLOW_UNSIGNED=1 ile imzasiz kopyalaniyor"
      cp "${binary}" "${output}"
    else
      die "CODESIGN_IDENTITY tanimli degil. Imzasiz release yasaktir (test icin ALLOW_UNSIGNED=1 kullanin)"
    fi
  elif [[ "$ALLOW_UNSIGNED" == "1" ]]; then
    log "Imzalama araci/sertifika bulunamadi; ALLOW_UNSIGNED=1 ile imzasiz kopyalaniyor"
    cp "${binary}" "${output}"
  else
    die "Imzalama sertifikasi veya araci bulunamadi. Imzasiz release yasaktir (test icin ALLOW_UNSIGNED=1 kullanin)"
  fi
}

build_and_sign() {
  local target="$1"
  local output_name="$2"

  log "Building for ${target}..."
  cargo build \
    --manifest-path "${CORE_DIR}/Cargo.toml" \
    --target "${target}" \
    --locked \
    --release 2>&1

  local ext=""
  [[ "${target}" == *"windows"* ]] && ext=".exe"
  local binary="${CORE_DIR}/target/${target}/release/untracx${ext}"
  [[ -f "${binary}" ]] || die "Binary bulunamadi: ${binary}"

  sign_binary "${binary}" "${DIST_DIR}/${output_name}"
  log "Output binary: ${DIST_DIR}/${output_name}"
}

main() {
  mkdir -p "${DIST_DIR}"

  case "${1:-$(uname -s)}" in
    Linux|linux)
      build_and_sign "x86_64-unknown-linux-gnu" "untracx-linux-x86_64"
      ;;
    Darwin|darwin|macos)
      build_and_sign "x86_64-apple-darwin" "untracx-macos-x86_64"
      build_and_sign "aarch64-apple-darwin" "untracx-macos-arm64"
      ;;
    Windows|windows|MINGW*|MSYS*|CYGWIN*)
      build_and_sign "x86_64-pc-windows-msvc" "untracx-windows-x86_64.exe"
      ;;
    all)
      log "Cross-compiling available targets on this host..."
      build_and_sign "x86_64-apple-darwin" "untracx-macos-x86_64"
      build_and_sign "aarch64-apple-darwin" "untracx-macos-arm64"
      ;;
    *)
      die "Desteklenmeyen platform: ${1:-$(uname -s)}"
      ;;
  esac

  log "Paketler ${DIST_DIR}/ klasorunde:"
  ls -la "${DIST_DIR}/"

  log "SHA-256 saglamalar yaziliyor: ${DIST_DIR}/checksums.txt"
  local -a sha_cmd
  if command -v sha256sum > /dev/null 2>&1; then
    sha_cmd=(sha256sum)
  elif command -v shasum > /dev/null 2>&1; then
    sha_cmd=(shasum -a 256)
  else
    die "sha256sum veya shasum bulunamadi"
  fi
  (cd "${DIST_DIR}" && find . -maxdepth 1 -type f ! -name 'checksums.txt' -exec "${sha_cmd[@]}" {} + > checksums.txt)
  cat "${DIST_DIR}/checksums.txt"
}

main "$@"
