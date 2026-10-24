#!/usr/bin/env bash
# An FTP server for the smoke suite's FTP cases: vsftpd in Docker (Alpine), user `forge` /
# password `forge` on TCP <port> of this computer (passive ports 21100-21110), its home a folder
# here holding a generated game `game-ftp` and a writable `out`. Idle sessions are closed after
# FTP_IDLE seconds (default 20; vsftpd's own is 300), so the suite's stale-session case waits briefly.
#
#   tests/scripts/ftp.sh up [port] [pasv-address]   # default 2121, 127.0.0.1; prints FORGE_FTP / FORGE_FTP_DIR
#   tests/scripts/ftp.sh down
#
# The console must reach this computer on <port> and the passive ports: give this computer's LAN IP
# as <pasv-address> (the address vsftpd tells clients to connect back to).
# vsftpd runs per connection under busybox's tcpsvd (listen=NO): its own standalone listener
# (listen=YES) segfaulted after ~200 quick sessions here (exit 139), taking the container down.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
name=forge-smoke-ftp
dir=${FORGE_FTP_DIR:-${TMPDIR:-/tmp}/forge-smoke-ftp}

case "${1:-}" in
up)
  port=${2:-2121}
  pasv=${3:-127.0.0.1}
  mkdir -p "$dir/out"
  chmod 777 "$dir" "$dir/out"
  dir=$(cd "$dir" && pwd -P)
  [ -d "$dir/game-ftp" ] ||
    node "$here/gen-game.mjs" "$dir/game-ftp" --files 200 --assets-mib 8 --big-mib 24 \
      --title-id PPSA99904 --name "Forge Smoke FTP" >/dev/null
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker run -d --name "$name" -p "$port:21" -p 21100-21110:21100-21110 -v "$dir:/home/forge" \
    -e PASV="$pasv" -e IDLE="${FTP_IDLE:-20}" alpine:3.24 sh -c '
    apk add --no-cache vsftpd busybox-extras >/dev/null &&
    { adduser -D -h /home/forge forge 2>/dev/null || true; } && echo forge:forge | chpasswd &&
    printf "%s\n" listen=NO anonymous_enable=NO local_enable=YES write_enable=YES local_umask=000 \
      chroot_local_user=YES allow_writeable_chroot=YES seccomp_sandbox=NO pasv_enable=YES \
      pasv_min_port=21100 pasv_max_port=21110 pasv_address=$PASV pasv_addr_resolve=NO \
      idle_session_timeout=$IDLE \
      >/etc/vsftpd/vsftpd.conf &&
    exec tcpsvd -c 64 0.0.0.0 21 vsftpd /etc/vsftpd/vsftpd.conf' >/dev/null
  # Docker's port proxy accepts before tcpsvd runs: wait for the process (apk may be slow).
  for _ in $(seq 180); do
    docker exec "$name" pidof tcpsvd >/dev/null 2>&1 && break
    sleep 1
  done
  docker exec "$name" pidof tcpsvd >/dev/null || { docker logs "$name" | tail -20; exit 1; }
  echo "export FORGE_FTP_DIR=$dir"
  echo "export FORGE_FTP=$pasv:$port"
  ;;
down)
  docker rm -f "$name" >/dev/null 2>&1 || true
  ;;
*)
  echo "usage: tests/scripts/ftp.sh up [port] [pasv-address] | down" >&2
  exit 2
  ;;
esac
