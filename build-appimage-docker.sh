#!/usr/bin/env bash
set -euo pipefail

# Build the AppImage inside Docker and copy out artifacts to ./build-artifacts

IMAGE_NAME=ddgp-tauri
CONTAINER_OUT_DIR=/home/tauri/client/src-tauri/target/release/bundle

docker build -t "$IMAGE_NAME" -f client/Dockerfile .

CONTAINER_ID=$(docker create "$IMAGE_NAME")
mkdir -p build-artifacts
docker cp "$CONTAINER_ID":"$CONTAINER_OUT_DIR" ./build-artifacts || true
docker rm "$CONTAINER_ID"

echo "Done. Artifacts (if produced) copied to ./build-artifacts"
