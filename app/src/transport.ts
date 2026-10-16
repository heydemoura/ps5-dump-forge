// What api.ts runs on. Two implementations, picked at build time by the `forge-transport`
// alias (vite.config.ts): transport-tauri.tsx (the app, `npm run build`) and
// transport-http.tsx (the PS5 web UI, `npm run build:http`). Types only here.

export type Unlisten = () => void;

/** The events api.ts listens to. `jobs://restore` comes from the http poller only. */
export type EventName =
  | "job://progress"
  | "job://stages"
  | "job://log"
  | "job://done"
  | "close-requested"
  | "jobs://restore";

export interface PickOptions {
  /** A folder, else a file. */
  directory: boolean;
  title: string;
  /** File mode: the extensions offered (without the dot). */
  extensions?: string[];
  /** File mode: what the extensions are, for the dialog's filter menu. */
  filterName?: string;
  /** File mode, http build only: the current folder can be chosen too ("Choose this folder").
   * The native dialog can't pick both kinds at once (rfd: files or folders), so the app asks
   * which kind first. */
  folderToo?: boolean;
  /** The folder to open at (else where the last browse ended). */
  start?: string;
}

export interface Transport {
  /** The http build (a browser talking to `ps5-dump-forge serve`). */
  web: boolean;
  /** A Tauri command, or `POST /api/<cmd>`; rejects with the command's error string. */
  call<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  listen<T>(event: EventName, f: (payload: T) => void): Promise<Unlisten>;
  /** A folder or file path, or null when cancelled. */
  pick(o: PickOptions): Promise<string | null>;
  /** The server can't be reached right now (http only). */
  useOffline(): boolean;
  /** The server's `host:port` as its session reports it (http only; the app: null). */
  address(): string | null;
  /** Where the backend runs: the app is always "host"; the http build asks the server. */
  platform(): Promise<"host" | "ps5">;
  /** Patch a game folder in place for LZ4 tracing (api.ts `Lz4Patch`). Its own function: the
   * Tauri command takes `path`, the route `source`. */
  lz4Patch<T>(source: string): Promise<T>;
  /** Put Forge's release runtime back in a game folder (same argument names as lz4Patch). */
  lz4Unpatch<T>(source: string): Promise<T>;
  /** The running version and its release file's suffix (after `ps5-dump-forge-<v>-`), or null
   * when this build gets no updates (the http build on a computer). */
  updateTarget(): Promise<{ version: string; asset: string } | null>;
  /** Install `version`: the PS5 has elfldr load it, then the page reloads once the new server
   * answers (rejects with the server's error or update.ts's `UPDATE_TIMEOUT`); the app opens
   * the release archive's download in the system browser. */
  startUpdate(version: string): Promise<void>;
}
