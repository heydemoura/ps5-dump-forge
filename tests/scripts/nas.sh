#!/usr/bin/env bash
# A NAS for the smoke suite's NAS cases and the SMB integration tests: Samba in Docker (Alpine), a
# guest share `games` on TCP <port> of this computer, holding a generated game `game-nas`, the
# tests' `Stub Game` and a writable folder `out` (the games are only read).
#
#   tests/scripts/nas.sh up [port]     # default 1445; prints FORGE_NAS / FORGE_NAS_DIR to export
#   tests/scripts/nas.sh down
#
# The console must reach this computer on <port> (FORGE_NAS=<this computer's LAN IP>:<port>).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
name=forge-smoke-nas
dir=${FORGE_NAS_DIR:-${TMPDIR:-/tmp}/forge-smoke-nas}

case "${1:-}" in
up)
  port=${2:-1445}
  mkdir -p "$dir/out"
  chmod 777 "$dir" "$dir/out"
  dir=$(cd "$dir" && pwd -P)
  [ -d "$dir/game-nas" ] ||
    node "$here/gen-game.mjs" "$dir/game-nas" --files 200 --assets-mib 8 --big-mib 24 \
      --title-id PPSA99903 --name "Forge Smoke NAS" >/dev/null
  # What crates/*/tests/smb*.rs and server.rs expect: a 4 KiB eboot and a 4 MiB data/stub.bin.
  if [ ! -f "$dir/Stub Game/data/stub.bin" ]; then
    node "$here/gen-game.mjs" "$dir/Stub Game" --files 0 --assets-mib 0 --big-mib 0 \
      --title-id PPSA99999 --name "Stub Game" >/dev/null
    rm -rf "$dir/Stub Game/data"
    mkdir -p "$dir/Stub Game/data"
    head -c 4096 "$dir/Stub Game/eboot.bin" >"$dir/Stub Game/eboot.4k" &&
      mv "$dir/Stub Game/eboot.4k" "$dir/Stub Game/eboot.bin"
    dd if=/dev/urandom of="$dir/Stub Game/data/stub.bin" bs=1048576 count=4 2>/dev/null
  fi
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker run -d --name "$name" -p "$port:445" -v "$dir:/share" alpine:3.24 sh -c '
    apk add --no-cache samba >/dev/null &&
    cat >/etc/samba/smb.conf <<EOF
[global]
  server role = standalone server
  server min protocol = SMB2_02
  map to guest = Bad User
  guest account = nobody
  disable netbios = yes
  smb ports = 445
  load printers = no
[games]
  path = /share
  read only = no
  guest ok = yes
  create mask = 0666
  directory mask = 0777
  guest only = yes
  browseable = yes
EOF
    exec smbd --foreground --no-process-group --debug-stdout' >/dev/null
  # apk fetches Samba first: allow a slow mirror.
  for _ in $(seq 180); do
    docker logs "$name" 2>&1 | grep -q "smbd version .* started" && break
    sleep 1
  done
  docker logs "$name" 2>&1 | grep -q "smbd version .* started" || { docker logs "$name" | tail -20; exit 1; }
  echo "export FORGE_NAS_DIR=$dir"
  echo "export FORGE_SMB_TEST=smb://127.0.0.1:$port/games FORGE_SMB_TEST_SHARE_DIR=$dir   # the SMB integration tests"
  echo "export FORGE_NAS=<this computer's LAN IP>:$port   # 127.0.0.1:$port for tests/scripts/dry-run.sh"
  ;;
down)
  docker rm -f "$name" >/dev/null 2>&1 || true
  ;;
*)
  echo "usage: tests/scripts/nas.sh up [port] | down" >&2
  exit 2
  ;;
esac
