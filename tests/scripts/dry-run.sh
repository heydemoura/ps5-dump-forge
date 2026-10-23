#!/usr/bin/env bash
# The smoke suite against two Forges on this computer (no console): A and B each get their own
# temporary home (connect identity, pairings and share root), ports and FLINK port, so nothing of
# the real app's state is touched. Arguments go to smoke.mjs (--only, --keep).
#
#   tests/scripts/dry-run.sh [--only 3,5-7] [--keep]      # FORGE_BIN=path/to/ps5-dump-forge to pick a build
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
bin=${FORGE_BIN:-$here/../../target/release/ps5-dump-forge}
[ -x "$bin" ] || { echo "build it first: cargo build --release -p ps5-dump-forge-cli" >&2; exit 2; }
work=${DRY_RUN_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/forge-dry.XXXXXX")}
work=$(cd "$work" && pwd -P)
mkdir -p "$work/a" "$work/b"
http=${DRY_RUN_PORT:-18095}   # A's HTTP port, B's is the next one
flink=${DRY_RUN_FLINK:-19120} # A's FLINK port, B's is the next one
# Ports another Forge (or anything) already answers on would serve the suite instead of ours.
for port in $http $((http + 1)); do
  if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$port/"; then
    echo "port $port is in use: stop what serves it or set DRY_RUN_PORT" >&2
    exit 2
  fi
done
pids=()
trap 'kill "${pids[@]}" 2>/dev/null; wait 2>/dev/null' EXIT

HOME=$work/a FORGE_FLINK_PORT=$flink "$bin" serve --port $http --root "$work/a" >"$work/a.log" 2>&1 &
pids+=($!)
HOME=$work/b FORGE_FLINK_PORT=$((flink + 1)) "$bin" serve --port $((http + 1)) --root "$work/b" >"$work/b.log" 2>&1 &
pids+=($!)
for port in $http $((http + 1)); do
  for _ in $(seq 50); do curl -sf "http://127.0.0.1:$port/api/session" >/dev/null && break; sleep 0.2; done
done
for pid in "${pids[@]}"; do
  kill -0 "$pid" 2>/dev/null || { echo "a Forge exited at start (see $work/a.log, $work/b.log)" >&2; exit 2; }
done

echo "dry run in $work (logs: a.log, b.log)"
FORGE_A=http://127.0.0.1:$http FORGE_B=http://127.0.0.1:$((http + 1)) \
  A_WORK=$work/a/forge-smoke-work B_PARENT=$work/b \
  node "$here/smoke.mjs" "$@"
