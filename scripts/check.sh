#!/usr/bin/env bash
# untracx - Local and CI Integrated Quality Verification Suite
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
STRICT="${STRICT:-${CI:-0}}"

log() { printf '\n[untracx-check] %s\n' "$*"; }
die() { printf '\n[untracx-check] ERROR: %s\n' "$*" >&2; exit 1; }

shopt -s nullglob

log "1/8 Shell script syntax verification..."
for script in "$ROOT_DIR"/server/*.sh "$ROOT_DIR"/scripts/*.sh "$ROOT_DIR"/tests/*.sh; do
  bash -n "$script"
done

log "2/8 ShellCheck static analysis..."
if command -v shellcheck > /dev/null 2>&1; then
  shellcheck "$ROOT_DIR"/server/*.sh "$ROOT_DIR"/scripts/*.sh "$ROOT_DIR"/tests/*.sh
elif [[ "$STRICT" == "1" || "$STRICT" == "true" ]]; then
  die "shellcheck is not installed. CI/Strict mode requires shellcheck."
else
  printf 'NOTE: shellcheck not installed; skipping static shell linting.\n' >&2
fi

log "3/8 Rust Core fmt, test, clippy..."
cargo fmt --manifest-path "$ROOT_DIR/core/Cargo.toml" -- --check
cargo test --manifest-path "$ROOT_DIR/core/Cargo.toml" --locked
cargo clippy --manifest-path "$ROOT_DIR/core/Cargo.toml" --locked -- -D warnings

log "4/8 Rust Windows cross-compilation check..."
if rustup target list | grep -q "x86_64-pc-windows-msvc (installed)"; then
  cargo check --manifest-path "$ROOT_DIR/core/Cargo.toml" --target x86_64-pc-windows-msvc --locked
else
  printf 'NOTE: x86_64-pc-windows-msvc target not installed (rustup target add x86_64-pc-windows-msvc).\n' >&2
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
    die "gui/frontend/node_modules missing. CI/Strict mode requires frontend dependencies."
  else
    printf 'NOTE: node_modules missing; run npm install first.\n' >&2
  fi
fi

log "7/8 Peer Lifecycle Fixture Tests..."
if [[ -f "$ROOT_DIR/tests/test-peer-lifecycle.sh" ]]; then
  bash "$ROOT_DIR/tests/test-peer-lifecycle.sh"
fi

log "8/8 Security auditing (cargo-audit / npm audit)..."
if cargo audit --version > /dev/null 2>&1; then
  cargo audit --manifest-path "$ROOT_DIR/core/Cargo.toml" --deny warnings
  cargo audit --manifest-path "$ROOT_DIR/gui/Cargo.toml" --deny warnings
elif [[ "$STRICT" == "1" || "$STRICT" == "true" ]]; then
  die "cargo-audit is not installed. CI/Strict mode requires security auditing."
else
  printf 'NOTE: cargo-audit not installed; install with cargo install cargo-audit.\n' >&2
fi

log "ALL CHECKS PASSED (PASS)"
