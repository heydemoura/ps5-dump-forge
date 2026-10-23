// The desktop app's transport: Tauri IPC, Tauri events and the native file dialog.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";

import { basename } from "./paths";
import { picker, type Listing, type SavedDevices } from "./Picker";
import type { DropEvent, PickOptions, Transport, Unlisten } from "./transport";

/** The system dialog: a folder, a file, or (`multiple`) several files. */
async function native(o: PickOptions, multiple: boolean): Promise<string[] | null> {
  const filters = !o.directory && o.extensions ? [{ name: o.filterName ?? o.title, extensions: o.extensions }] : undefined;
  if (multiple) {
    const p = await open({ multiple: true, title: o.title, defaultPath: o.start, filters });
    return Array.isArray(p) && p.length > 0 ? p : null;
  }
  const p = await open({ directory: o.directory, title: o.title, defaultPath: o.start, filters });
  return typeof p === "string" ? [p] : null;
}

/** This device's roots in the custom picker: the home folder and the volume folders there are
 * (ponytail: no drive letters on Windows; its System dialog button reaches them). */
async function localRoots(): Promise<Listing> {
  const home = await invoke<string | null>("home_folder");
  const vols = /Windows/.test(navigator.userAgent) ? [] : ["/Volumes", "/media", "/run/media", "/mnt"];
  const found = await Promise.all(vols.map((p) => invoke("list_dir", { path: p }).then(() => p, () => null)));
  const paths = [home, ...found].filter((p): p is string => p !== null);
  return { path: null, parent: null, entries: paths.map((p) => ({ name: basename(p), path: p, dir: true, size: null })) };
}

/** The system dialog, or the custom picker: for a saved NAS (the system dialog can't browse
 * `smb://`) and, while another device is online, with its tabs. */
const { pick, pickFiles } = picker({
  list: (path) => (path === null ? localRoots() : invoke("list_dir", { path })),
  saved: () => invoke<SavedDevices>("connect_state"),
  native,
});

/** The webview's drag and drop (Tauri 2 keeps it on, so the page sees no HTML5 file drops).
 * The page wants CSS pixels. Tauri labels the position physical, but only WebView2 (Windows)
 * reports device pixels: wry passes macOS's NSView points and GTK's logical units through
 * unscaled, so dividing those by the pixel ratio put a Retina drop at half its place. */
const PHYSICAL_DROPS = /Windows/.test(navigator.userAgent);
function onDrop(f: (d: DropEvent) => void, over?: (at: { x: number; y: number } | null) => void): Unlisten {
  let stop: Unlisten | null = null;
  let gone = false;
  void getCurrentWebview()
    .onDragDropEvent(({ payload: e }) => {
      if (e.type === "leave") return over?.(null);
      const r = PHYSICAL_DROPS ? window.devicePixelRatio || 1 : 1;
      const at = { x: e.position.x / r, y: e.position.y / r };
      if (e.type !== "drop") return over?.(at);
      over?.(null);
      const items = e.paths.map((path) => ({ name: basename(path), path }));
      if (items.length > 0) f({ ...at, items });
    })
    .then((u) => (gone ? u() : (stop = u)))
    .catch((e) => console.error("drag and drop unavailable", e));
  return () => {
    gone = true;
    stop?.();
  };
}

export const transport: Transport = {
  web: false,
  call: (cmd, args) => invoke(cmd, args),
  listen: <T,>(event: string, f: (payload: T) => void): Promise<Unlisten> =>
    // The restore event is the http poller's; nothing in the app sends it.
    event === "jobs://restore" ? Promise.resolve(() => {}) : listen<T>(event, (e) => f(e.payload)),
  pick,
  pickFiles,
  hostTree: (path) => invoke("host_tree", { path }),
  useOffline: () => false,
  address: () => null,
  debug: () => false,
  platform: () => Promise.resolve("host"),
  lz4Patch: (path) => invoke("lz4_patch", { path }),
  lz4Unpatch: (path) => invoke("lz4_unpatch", { path }),
  updateTarget: () => invoke("update_target"),
  startUpdate: (version) => invoke("open_update", { version }),
  onDrop,
  // A drop here is a host path: an `add` takes it as it is.
  stage: () => Promise.reject("Uploads are for the web page only."),
  discardStaged: () => Promise.resolve(),
  connect: (cmd, args) => invoke(`connect_${cmd}`, args),
  connectUpload: () => Promise.reject("uploads come from the http build only"),
  connectDownloadUrl: () => null,
};
