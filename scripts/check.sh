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

printf 'Tum yerel kontroller basarili.\n'
