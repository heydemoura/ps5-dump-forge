// The http build's transport (`npm run build:http`): a browser on the LAN talking to
// `ps5-dump-forge serve`. No Tauri code reaches this bundle (vite.config.ts aliases
// `forge-transport` here).

import { useSyncExternalStore } from "react";

import { reloadForUpdate } from "./appcache";
import {
  call,
  getStatus,
  listen,
  selfUpdate,
  serverAddress,
  serverPlatform,
  serverUpdateTarget,
  watchStatus,
} from "./http-client";
import { setServerSeparator } from "./paths";
import { pick } from "./Picker";
import type { Transport } from "./transport";

// Paths are the server's: `/` until its session says otherwise (main-http.tsx asks it before
// the app renders), never the viewer's OS. The poller starts from main-http.tsx too.
setServerSeparator("/");

export const transport: Transport = {
  web: true,
  call,
  listen,
  pick,
  useOffline: () => useSyncExternalStore(watchStatus, getStatus).offline,
  address: serverAddress,
  platform: serverPlatform,
  lz4Patch: (source) => call("lz4_patch", { source }),
  lz4Unpatch: (source) => call("lz4_unpatch", { source }),
  updateTarget: serverUpdateTarget,
  // The new version serves a new bundle: AppCache swaps it in and reloads (appcache.ts, when no
  // dialog is open); otherwise the page just reloads.
  startUpdate: async (version) => {
    await selfUpdate(version);
    reloadForUpdate();
  },
};
