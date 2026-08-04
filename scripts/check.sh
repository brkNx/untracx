#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

for script in "$ROOT_DIR"/server/*.sh "$ROOT_DIR"/scripts/*.sh; do
  bash -n "$script"
done

if command -v shellcheck > /dev/null 2>&1; then
  shellcheck "$ROOT_DIR"/server/*.sh "$ROOT_DIR"/scripts/*.sh
else
  printf 'NOT: shellcheck kurulu degil; statik shell lint atlandi.\n' >&2
fi

cargo fmt --manifest-path "$ROOT_DIR/core/Cargo.toml" -- --check
cargo test --manifest-path "$ROOT_DIR/core/Cargo.toml" --locked
cargo clippy --manifest-path "$ROOT_DIR/core/Cargo.toml" --locked -- -D warnings

if [[ -d "$ROOT_DIR/gui" ]]; then
  cargo fmt --manifest-path "$ROOT_DIR/gui/Cargo.toml" -- --check
  cargo clippy --manifest-path "$ROOT_DIR/gui/Cargo.toml" --locked -- -D warnings
  if [[ -d "$ROOT_DIR/gui/frontend/node_modules" ]]; then
    (cd "$ROOT_DIR/gui/frontend" && npm run build > /dev/null)
  else
    printf 'NOT: gui/frontend/node_modules yok; frontend build atlandi. once: cd gui/frontend && npm install\n' >&2
  fi
fi

printf 'Tum yerel kontroller basarili.\n'
