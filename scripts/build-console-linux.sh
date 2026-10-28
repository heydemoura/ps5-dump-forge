#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
arch="${1:-amd64}"
case "$arch" in amd64|arm64) ;; *) echo 'Usage: scripts/build-console-linux.sh [amd64|arm64]' >&2; exit 2 ;; esac
docker build --platform "linux/$arch" -f Dockerfile.console --target artifact \
  --output "type=local,dest=dist/console-linux-$arch" .
