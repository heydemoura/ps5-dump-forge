#!/usr/bin/env bash
# NFS servers for the NFS integration tests and smoke cases, one per version, both exporting
# `/share` (rw, no root squash, any client port) with a generated game `game-nfs` and a writable
# folder `out`:
#   forge-smoke-nfs3: unfs3 (Alpine), NFSv3 only, NFS and MOUNT on one port, no portmapper:
#                     TCP 12049 here; its /share is the folder here (FORGE_NFS_DIR).
#   forge-smoke-nfs4: NFS-Ganesha 6 with the VFS FSAL (Debian), NFSv4.1: TCP 12050 here.
#                     Its /share is a Docker volume holding a copy of game-nfs and an empty out:
#                     the VFS FSAL needs file handles (name_to_handle_at), which Docker Desktop's
#                     bind mounts don't give (nor does an NFS mount or tmpfs to Ganesha). Read what
#                     it holds with `docker exec forge-smoke-nfs4 ls /share/out` / `docker cp`.
#
#   tests/scripts/nfs.sh up [host]   # prints FORGE_NFS_DIR / FORGE_NFS3 / FORGE_NFS4 (host: 127.0.0.1)
#   tests/scripts/nfs.sh down
#
# The console must reach this computer on 12049 / 12050 (host = this computer's LAN IP).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
v3=forge-smoke-nfs3
v4=forge-smoke-nfs4
dir=${FORGE_NFS_DIR:-${TMPDIR:-/tmp}/forge-smoke-nfs}

# Waits up to 300 s (apk/apt may be slow) for container $1 to log $2; Docker's port proxy
# accepts before the server runs, so a connect proves nothing.
wait_for() {
  for _ in $(seq 300); do
    docker logs "$1" 2>&1 | grep -q "$2" && return 0
    docker ps -q --filter "name=^$1\$" | grep -q . || break
    sleep 1
  done
  docker logs "$1" 2>&1 | tail -20
  echo "$1 did not start" >&2
  exit 1
}

case "${1:-}" in
up)
  host=${2:-127.0.0.1}
  mkdir -p "$dir/out"
  chmod 777 "$dir" "$dir/out"
  dir=$(cd "$dir" && pwd -P)
  [ -d "$dir/game-nfs" ] ||
    node "$here/gen-game.mjs" "$dir/game-nfs" --files 200 --assets-mib 8 --big-mib 24 \
      --title-id PPSA99905 --name "Forge Smoke NFS" >/dev/null
  docker rm -f "$v3" "$v4" >/dev/null 2>&1 || true
  docker volume rm "$v4" >/dev/null 2>&1 || true

  docker run -d --name "$v3" -p 12049:2049 -v "$dir:/share" alpine:3.24 sh -c '
    apk add --no-cache unfs3 >/dev/null &&
    echo "/share (rw,insecure,no_root_squash)" >/etc/exports &&
    echo "unfsd starting" && exec unfsd -d -p -t -n 2049 -m 2049 -e /etc/exports' >/dev/null

  docker run -d --name "$v4" --cap-add DAC_READ_SEARCH --cap-add SYS_RESOURCE -p 12050:2049 \
    -v "$v4:/share" -v "$dir/game-nfs:/game-nfs:ro" debian:trixie sh -c '
    apt-get update >/dev/null 2>&1 &&
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      nfs-ganesha nfs-ganesha-vfs >/dev/null 2>&1 &&
    cp -R /game-nfs /share/ && mkdir -p /share/out && chmod -R a+rwX /share &&
    mkdir -p /var/run/ganesha /var/lib/nfs/ganesha &&
    cat >/etc/ganesha/forge.conf <<EOF &&
NFS_CORE_PARAM { Protocols = 4; NFS_Port = 2049; Enable_NLM = false; Enable_RQUOTA = false; }
NFSV4 { Minor_Versions = 1, 2; Graceless = true; }
EXPORT {
  Export_Id = 1; Path = /share; Pseudo = /share; Access_Type = RW; Squash = No_Root_Squash;
  SecType = sys; Protocols = 4; Transports = TCP; FSAL { Name = VFS; }
}
LOG { Default_Log_Level = EVENT; }
EOF
    exec ganesha.nfsd -F -L STDOUT -f /etc/ganesha/forge.conf' >/dev/null

  wait_for "$v3" "unfsd starting"
  for _ in $(seq 30); do
    docker exec "$v3" pidof unfsd >/dev/null 2>&1 && break
    sleep 1
  done
  docker exec "$v3" pidof unfsd >/dev/null || { docker logs "$v3" | tail -20; exit 1; }
  wait_for "$v4" "NFS SERVER INITIALIZED"
  if docker logs "$v4" 2>&1 | grep -q "Could not create export"; then
    docker logs "$v4" 2>&1 | grep CRIT | tail -20
    exit 1
  fi
  echo "export FORGE_NFS_DIR=$dir"
  echo "export FORGE_NFS3=$host:12049 FORGE_NFS4=$host:12050"
  echo "# the integration tests, once per server:"
  echo "FORGE_NFS_TEST=nfs://127.0.0.1:12049/share/out FORGE_NFS_TEST_VERSION=NFSv3" \
    "FORGE_NFS_TEST_LOCAL=$dir/out cargo test -p ps5-dump-forge-nfs --test server"
  echo "FORGE_NFS_TEST=nfs://127.0.0.1:12050/share/out FORGE_NFS_TEST_VERSION=NFSv4.1" \
    "FORGE_NFS_TEST_CONTAINER=$v4 cargo test -p ps5-dump-forge-nfs --test server"
  ;;
down)
  docker rm -f "$v3" "$v4" >/dev/null 2>&1 || true
  docker volume rm "$v4" >/dev/null 2>&1 || true
  ;;
*)
  echo "usage: tests/scripts/nfs.sh up [host] | down" >&2
  exit 2
  ;;
esac
