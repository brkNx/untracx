.PHONY: all build build-cli build-gui dev-gui test test-core test-gui lint lint-gui clean check release deploy-oracle
SHELL := /bin/bash
.DELETE_ON_ERROR:

all: build

build: build-cli build-gui

build-cli:
	cargo build --manifest-path core/Cargo.toml --locked --release

build-gui:
	cd gui/frontend && npm ci && npm run build
	cargo build --manifest-path gui/Cargo.toml --locked --release

dev-gui:
	cd gui/frontend && npm run dev

test: test-core test-gui

test-core:
	cargo test --manifest-path core/Cargo.toml --locked

test-gui:
	cd gui/frontend && npm run test

lint: lint-gui

lint-gui:
	cd gui/frontend && npm run lint && npm run format:check

check:
	./scripts/check.sh

clean:
	cargo clean --manifest-path core/Cargo.toml
	cargo clean --manifest-path gui/Cargo.toml
	rm -rf gui/frontend/dist gui/frontend/node_modules
	rm -rf dist/

release:
	bash scripts/sign-package.sh

deploy-oracle:
	bash scripts/deploy-oracle.sh $${ORACLE_HOST:-oracle} $${PEER:-}

