#!/usr/bin/env bash
# untracx - Yerel ve CI Tumlesik Kalite Dogrulama Suite'i
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
STRICT="${STRICT:-${CI:-0}}"

log() { printf '\n[untracx-check] %s\n' "$*"; }
die() { printf '\n[untracx-check] HATA: %s\n' "$*" >&2; exit 1; }

shopt -s nullglob

log "1/8 Shell script soz dizimi denetimi..."
for script in "$ROOT_DIR"/server/*.sh "$ROOT_DIR"/scripts/*.sh "$ROOT_DIR"/tests/*.sh; do
  bash -n "$script"
done

log "2/8 ShellCheck statik analiz..."
if command -v shellcheck > /dev/null 2>&1; then
  shellcheck "$ROOT_DIR"/server/*.sh "$ROOT_DIR"/scripts/*.sh "$ROOT_DIR"/tests/*.sh
elif [[ "$STRICT" == "1" || "$STRICT" == "true" ]]; then
  die "shellcheck kurulu degil. CI/Strict modunda kontrol atlanamaz."
else
  printf 'NOT: shellcheck kurulu degil; statik shell lint atlandi.\n' >&2
fi

log "3/8 Rust Core fmt, test, clippy..."
cargo fmt --manifest-path "$ROOT_DIR/core/Cargo.toml" -- --check
cargo test --manifest-path "$ROOT_DIR/core/Cargo.toml" --locked
cargo clippy --manifest-path "$ROOT_DIR/core/Cargo.toml" --locked -- -D warnings

log "4/8 Rust Windows cross-compilation check..."
if rustup target list | grep -q "x86_64-pc-windows-msvc (installed)"; then
  cargo check --manifest-path "$ROOT_DIR/core/Cargo.toml" --target x86_64-pc-windows-msvc --locked
else
  printf 'NOT: x86_64-pc-windows-msvc target kurulu degil (rustup target add x86_64-pc-windows-msvc).\n' >&2
fi

log "5/8 Rust GUI fmt, clippy..."
if [[ -d "$ROOT_DIR/gui" ]]; then
  cargo fmt --manifest-path "$ROOT_DIR/gui/Cargo.toml" -- --check
  cargo clippy --manifest-path "$ROOT_DIR/gui/Cargo.toml" --locked -- -D warnings
fi

log "6/8 Frontend build, test, lint, format:check..."
if [[ -d "$ROOT_DIR/gui/frontend" ]]; then
  if [[ -d "$ROOT_DIR/gui/frontend/node_modules" ]]; then
    (cd "$ROOT_DIR/gui/frontend" && npm run build)
    (cd "$ROOT_DIR/gui/frontend" && npm run test)
    (cd "$ROOT_DIR/gui/frontend" && npm run lint)
    (cd "$ROOT_DIR/gui/frontend" && npm run format:check)
  elif [[ "$STRICT" == "1" || "$STRICT" == "true" ]]; then
    die "gui/frontend/node_modules eksik. CI/Strict modunda frontend kontrolu atlanamaz."
  else
    printf 'NOT: node_modules eksik; once npm install calistirin.\n' >&2
  fi
fi

log "7/8 Peer Lifecycle Fixture Testleri..."
if [[ -f "$ROOT_DIR/tests/test-peer-lifecycle.sh" ]]; then
  bash "$ROOT_DIR/tests/test-peer-lifecycle.sh"
fi

log "8/8 Guvenlik taramalari (cargo-audit / npm audit)..."
if cargo audit --version > /dev/null 2>&1; then
  cargo audit --manifest-path "$ROOT_DIR/core/Cargo.toml" --deny warnings
  cargo audit --manifest-path "$ROOT_DIR/gui/Cargo.toml" --deny warnings
elif [[ "$STRICT" == "1" || "$STRICT" == "true" ]]; then
  die "cargo-audit kurulu degil. CI/Strict modunda guvenlik taramasi zorunludur."
else
  printf 'NOT: cargo-audit kurulu degil; cargo install cargo-audit ile kurun.\n' >&2
fi

log "TUM KONTROLLER BASARILI (PASS)"
