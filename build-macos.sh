#!/bin/bash

set -e
rustup target add \
  x86_64-apple-darwin \
  aarch64-apple-darwin

echo "✅ Targets installed"

# Build macOS Intel
echo "🏗️ Building for macOS Intel (x86_64)..."
pnpm tauri build -- --target x86_64-apple-darwin

# Build macOS ARM
echo "🏗️ Building for macOS Apple Silicon (arm64)..."
pnpm tauri build -- --target aarch64-apple-darwin

echo "✅ All builds completed!"