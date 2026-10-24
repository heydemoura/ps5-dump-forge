// The Connect service's state, polled every 2 s by one loop shared by every subscriber (the
// header's Connected, the Connect screen, its dialogs). A response older than the newest
// request is dropped, so a slow answer never overwrites a fresh one.

import { useSyncExternalStore } from "react";

import { connect, errorText, type ConnectState } from "./api";
import { setDevices } from "./peers";

interface Snapshot {
  state: ConnectState | null;
  /** The last poll failed (service off, server unreachable); `state` is then null. */
  error: string | null;
}

let snapshot: Snapshot = { state: null, error: null };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
let epoch = 0;

function publish(next: Snapshot) {
  snapshot = next;
  // Kept while the service is unreachable: old errors still name the devices.
  if (next.state) setDevices(next.state.devices, next.state.nas);
  listeners.forEach((l) => l());
}

/** Ask now (after an action); the poll loop keeps its own pace. */
export async function refreshConnect(): Promise<void> {
  const ticket = ++generation;
  try {
    const state = await connect.state();
    if (listeners.size > 0 && ticket === generation) publish({ state, error: null });
  } catch (e) {
    // Never say Connected when the service can't be reached.
    if (listeners.size > 0 && ticket === generation) publish({ state: null, error: errorText(e) });
  }
}

async function poll(session: number) {
  await refreshConnect();
  if (listeners.size > 0 && session === epoch) timer = setTimeout(() => void poll(session), 2000);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) void poll(++epoch);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearTimeout(timer);
      generation++;
      epoch++;
    }
  };
}

const getSnapshot = () => snapshot;

export function useConnectState(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Saved devices online right now, paired peers and NAS devices (the header's Connected). */
export function useOnlineCount(): number {
  const s = useConnectState().state;
  return (s?.devices.filter((d) => d.online).length ?? 0) + (s?.nas.filter((n) => n.online).length ?? 0);
}
