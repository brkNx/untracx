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

# Bağımlılık güvenlik taraması (cargo-audit): kurulu değilse uyar, bloklamaz.
if cargo audit --version > /dev/null 2>&1; then
  cargo audit --manifest-path "$ROOT_DIR/core/Cargo.toml" --deny warnings
  cargo audit --manifest-path "$ROOT_DIR/gui/Cargo.toml" --deny warnings
else
  printf 'NOT: cargo-audit kurulu degil; bagimlilik taramasi atlandi. kurulum: cargo install cargo-audit\n' >&2
fi

# PowerShell betik analizi (PSScriptAnalyzer): pwsh kurulu degilse atlanir.
if command -v pwsh > /dev/null 2>&1; then
  if pwsh -NoProfile -Command 'Get-Module -ListAvailable PSScriptAnalyzer' > /dev/null 2>&1; then
    pwsh -NoProfile -Command \
      "Invoke-ScriptAnalyzer -Path '$ROOT_DIR/scripts/killswitch-windows.ps1' -Recurse -Severity Error"
  else
    printf 'NOT: PSScriptAnalyzer kurulu degil; PowerShell lint atlandi.\n' >&2
  fi
else
  printf 'NOT: pwsh kurulu degil; PowerShell lint atlandi.\n' >&2
fi

if [[ -d "$ROOT_DIR/gui" ]]; then
  cargo fmt --manifest-path "$ROOT_DIR/gui/Cargo.toml" -- --check
  cargo clippy --manifest-path "$ROOT_DIR/gui/Cargo.toml" --locked -- -D warnings
  if [[ -d "$ROOT_DIR/gui/frontend/node_modules" ]]; then
    (cd "$ROOT_DIR/gui/frontend" && npm run build > /dev/null)
    (cd "$ROOT_DIR/gui/frontend" && npm run test)
    (cd "$ROOT_DIR/gui/frontend" && npm run lint)
    (cd "$ROOT_DIR/gui/frontend" && npm run format:check)
  else
    printf 'NOT: gui/frontend/node_modules yok; frontend build/lint/test atlandi. once: cd gui/frontend && npm install\n' >&2
  fi
fi

printf 'Tum yerel kontroller basarili.\n'
