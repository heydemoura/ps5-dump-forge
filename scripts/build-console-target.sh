#!/usr/bin/env bash
# Runs inside Dockerfile.console, on the Docker builder's native architecture.
set -euo pipefail
case "${1:-amd64}" in
  amd64) forge_target=x86_64-unknown-linux-gnu; forge_machine=x86_64; forge_arch=amd64 ;;
  arm64) forge_target=aarch64-unknown-linux-gnu; forge_machine=aarch64; forge_arch=arm64 ;;
  *) echo 'Target must be amd64 or arm64' >&2; exit 2 ;;
esac
rustup target add --toolchain stable "$forge_target"
export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER=x86_64-linux-gnu-gcc
export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc
export CC_x86_64_unknown_linux_gnu=x86_64-linux-gnu-gcc
export CXX_x86_64_unknown_linux_gnu=x86_64-linux-gnu-g++
export CC_aarch64_unknown_linux_gnu=aarch64-linux-gnu-gcc
export CXX_aarch64_unknown_linux_gnu=aarch64-linux-gnu-g++
if [[ "$(dpkg --print-architecture)" != "$forge_arch" ]]; then
  export FORGE_CONSOLE_RUNNER="qemu-$forge_machine -L /usr/$forge_machine-linux-gnu"
  if [[ "$forge_arch" == amd64 ]]; then
    export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_RUNNER="$FORGE_CONSOLE_RUNNER"
  else
    export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_RUNNER="$FORGE_CONSOLE_RUNNER"
  fi
fi
cargo fmt --all --check
cargo clippy --locked --workspace --exclude ps5-dump-forge-gui --all-targets --target "$forge_target" -- -D warnings
# Same profile override upstream CI uses for test executables; the shipped binary
# is built separately with the unmodified release profile below.
CARGO_PROFILE_RELEASE_LTO=false CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16 \
  cargo test --locked --workspace --exclude ps5-dump-forge-gui --release --target "$forge_target"
cargo build --locked -p ps5-dump-forge-cli --release --target "$forge_target"
python3 scripts/check-console.py "target/$forge_target/release/ps5-dump-forge"
mkdir -p /out
cp "target/$forge_target/release/ps5-dump-forge" /out/ps5-dump-forge
