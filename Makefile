.PHONY: check clippy fmt fmt-check test build ci clean test-e2e test-all

# Run all checks
check: fmt-check clippy test

# Run clippy with warnings as errors
clippy:
	cargo clippy --manifest-path=src-tauri/Cargo.toml --all-targets --all-features -- -D warnings

# Format code
fmt:
	cargo fmt --manifest-path=src-tauri/Cargo.toml --all

# Check formatting without modifying files
fmt-check:
	cargo fmt --manifest-path=src-tauri/Cargo.toml --all -- --check

# Run Rust tests
test:
	cargo test --manifest-path=src-tauri/Cargo.toml

# Run E2E tests
test-e2e:
	npm run test:e2e

# Run all tests (Rust + E2E)
test-all: test test-e2e

# Build
build:
	cargo build --manifest-path=src-tauri/Cargo.toml

# CI pipeline
ci: fmt-check clippy test build
	cd . && npm run ci

# Clean build artifacts
clean:
	cargo clean --manifest-path=src-tauri/Cargo.toml
	npm run clean
