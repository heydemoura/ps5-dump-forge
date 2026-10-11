// The Library tab: the game dumps under one folder, as cards or rows. On a computer the user
// chooses the folder (nothing scans before that; a refused folder gets an error screen); on the
// PS5 the first visit scans the server's roots. The list, the folder and the view live in memory;
// only the first visit (PS5), Refresh and a newly chosen folder scan. Covers load one at a time
// after the list.

import { useEffect, useRef, useState } from "react";

import { api, errorText, pick, runtimePlatform, type LibraryEntry, type LibraryScan, type RuntimePlatform } from "./api";
import { basename, FormatPill, isWithin, notifyDeleted, onDeleted, PathLine } from "./common";
import { confirmDelete } from "./delete";
import { Icon } from "./icons";

const name = (e: LibraryEntry) => e.title_name || e.title_id || basename(e.path);

export function Library(props: {
  visible: boolean;
  onInspect: (entry: LibraryEntry) => void;
  onConvert: (entry: LibraryEntry) => void;
}) {
  const [platform, setPlatform] = useState<RuntimePlatform | null>(null);
  const [folder, setFolderState] = useState<string | null>(null); // the accepted folder (computer)
  const folderRef = useRef<string | null>(null); // the same, read at call time by scan
  const setFolder = (f: string | null) => {
    folderRef.current = f;
    setFolderState(f);
  };
  const [target, setTarget] = useState<string | null>(null); // the folder being scanned
  const [refused, setRefused] = useState(false); // a newly chosen folder failed: the error screen
  const [view, setView] = useState<"cards" | "list">("cards");
  const [result, setResult] = useState<LibraryScan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [, setCoverVersion] = useState(0);

  const scanning = useRef(false); // scan admission
  const attempted = useRef(false); // a first scan was tried
  const generation = useRef(0); // bumped by every scan; older cover answers are dropped
  // The list as of the last commit(): updated at once, so a scan that settles and a delete that
  // follows before React renders both see (and build on) the same list.
  const resultRef = useRef<LibraryScan | null>(null);
  const commit = (next: LibraryScan) => {
    resultRef.current = next;
    setResult(next);
  };
  const goneDuring = useRef<string[] | null>(null); // deletions while a scan runs
  // ponytail: every cover of the scan is kept in memory (<= 512 KiB each) and loaded top to
  // bottom; viewport-first loading and an LRU budget if libraries get huge.
  const covers = useRef(new Map<string, string>());
  const tried = useRef(new Set<string>());
  const pumping = useRef(false);
  const wellRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef<HTMLButtonElement>(null);
  const focusAt = useRef<number | null>(null);
  const deleting = useRef(false);

  // The platform, once; a failed lookup is retried by Refresh.
  const lookup = async (): Promise<RuntimePlatform | null> => {
    try {
      const p = await runtimePlatform();
      setPlatform(p);
      return p;
    } catch (e) {
      setError(errorText(e));
      return null;
    }
  };
  useEffect(() => void lookup(), []);

  const visibleRef = useRef(props.visible);
  visibleRef.current = props.visible;

  const pump = async () => {
    if (pumping.current) return;
    pumping.current = true;
    const failed = new Set<string>();
    try {
      for (;;) {
        const mine = generation.current;
        const next = resultRef.current?.entries.find((e) => e.has_cover && !tried.current.has(e.path) && !failed.has(e.path));
        if (scanning.current || !visibleRef.current || !next) return;
        tried.current.add(next.path);
        let url: string | null = null;
        try {
          url = await api.libraryCover(next.path);
        } catch {
          // A failed request (a 429, say) is retried by the next pump, not by this one.
          tried.current.delete(next.path);
          failed.add(next.path);
        }
        if (url && mine === generation.current && resultRef.current?.entries.some((e) => e.path === next.path)) {
          covers.current.set(next.path, url);
          setCoverVersion((v) => v + 1);
        }
      }
    } finally {
      pumping.current = false;
    }
  };

  // root: the folder to scan (a computer always has one); none: the PS5's roots. `fresh`: a newly
  // chosen folder, kept only if it is accepted.
  const scan = async (root: string | undefined = folderRef.current ?? undefined, fresh = false) => {
    if (scanning.current) return;
    scanning.current = true;
    attempted.current = true;
    goneDuring.current = [];
    setBusy(true);
    setTarget(root ?? null);
    setError(null);
    setNotice(null);
    setDeleteError(null);
    try {
      const r = await api.libraryScan(root);
      const gone = goneDuring.current ?? [];
      // The old covers go only now, with the old list; a failed scan keeps both.
      generation.current += 1;
      covers.current = new Map();
      tried.current = new Set();
      commit({ ...r, entries: r.entries.filter((e) => !gone.some((g) => isWithin(e.path, g))) });
      if (fresh) setFolder(root ?? null);
      setRefused(false);
    } catch (e) {
      setError(errorText(e));
      if (fresh) {
        // The old folder and list no longer match what the user asked for.
        generation.current += 1;
        covers.current = new Map();
        tried.current = new Set();
        resultRef.current = null;
        setResult(null);
        setFolder(null);
        setRefused(true);
      }
    } finally {
      goneDuring.current = null;
      scanning.current = false;
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (scanning.current) return;
    const p = platform ?? (await lookup());
    if (!p) return;
    setError(null);
    if (p === "host" && !folderRef.current) return;
    void scan();
  };

  const choose = async () => {
    if (scanning.current) return;
    const picked = await pick({ directory: true, title: "Choose a Library folder" });
    if (!picked || scanning.current) return;
    void scan(picked, true);
  };

  useEffect(() => {
    if (props.visible && platform === "ps5" && !attempted.current) void scan();
  }, [props.visible, platform]);

  // Covers load once a list is there and no scan runs (the effect sees committed state).
  useEffect(() => {
    if (result && !busy && props.visible) void pump();
  }, [result, busy, props.visible]);

  // Deleted anywhere (here or Inspect): drop what is gone.
  useEffect(
    () =>
      onDeleted((path) => {
        goneDuring.current?.push(path);
        const cur = resultRef.current;
        if (!cur) return;
        const i = cur.entries.findIndex((e) => isWithin(e.path, path));
        if (i < 0) return;
        if (wellRef.current?.contains(document.activeElement)) focusAt.current = i;
        for (const e of cur.entries) {
          if (isWithin(e.path, path)) {
            covers.current.delete(e.path);
            tried.current.add(e.path);
          }
        }
        commit({ ...cur, entries: cur.entries.filter((e) => !isWithin(e.path, path)) });
      }),
    [],
  );
  useEffect(() => {
    const i = focusAt.current;
    if (i === null || !result) return;
    focusAt.current = null;
    const items = wellRef.current?.querySelectorAll("li");
    const li = items?.[Math.min(i, items.length - 1)];
    (li?.querySelector("button") ?? refreshRef.current)?.focus();
  }, [result]);

  const remove = async (entry: LibraryEntry) => {
    if (deleting.current) return;
    deleting.current = true;
    const path = entry.path;
    try {
      if (!(await confirmDelete(path, entry.kind === "folder"))) return;
      setNotice(null);
      setDeleteError(null);
      await api.deletePath(path);
      notifyDeleted(path);
      setNotice(`Deleted ${path}`);
    } catch (e) {
      setNotice(null);
      setDeleteError(errorText(e));
    } finally {
      deleting.current = false;
    }
  };

  const entries = result?.entries ?? [];
  const host = platform === "host";
  const empty = host && !folder && !refused; // a computer with no folder chosen yet
  const body = busy ? (
    <div className="library-busy" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{target ? `Scanning ${basename(target)}…` : "Scanning…"}</span>
    </div>
  ) : refused ? (
    <div className="empty library-empty" role="alert">
      <span className="empty-icon bad">
        <Icon name="alert" />
      </span>
      <p className="empty-title">Can’t scan this folder</p>
      <p className="muted">{error}</p>
      <div className="row center">
        <button type="button" onClick={() => void choose()}>
          <Icon name="folder" />
          Choose another folder…
        </button>
      </div>
    </div>
  ) : empty ? (
    <div className="empty library-empty">
      <span className="empty-icon">
        <Icon name="folder" />
      </span>
      <p className="empty-title">Pick a folder with your library to scan</p>
      <div className="row center">
        <button type="button" className="primary" onClick={() => void choose()}>
          <Icon name="folder" />
          Choose folder…
        </button>
      </div>
    </div>
  ) : (
    <>
      {error && (
        <p className="library-msg" role="alert">
          <span className="tag orange">Can’t scan the Library:</span> {error}
        </p>
      )}
      {deleteError && (
        <p className="library-msg" role="alert">
          <span className="tag orange">Can’t delete:</span> {deleteError}
        </p>
      )}
      {notice && (
        <p className="library-msg muted" role="status">
          {notice}
        </p>
      )}
      {result && result.truncated && (
        <p className="library-msg" role="status">
          <span className="tag orange">Scan limit reached. This list may be incomplete.</span>{" "}
          <span className="muted">
            Discovery stops at six folder levels and after about 15 seconds of scanning.
          </span>
        </p>
      )}
      {result && result.roots.length === 0 && <p className="muted">No folders are available to scan.</p>}
      {result && result.roots.length > 0 && entries.length === 0 && (
        <p className="muted">
          No game dumps found. Discovery checks up to six levels deep and skips system folders. Other sources can still be chosen in Inspect or Convert.
        </p>
      )}
      {entries.length > 0 && (
        <ul className={view === "cards" ? "library-cards" : "library-rows"}>
          {entries.map((e) => (
            <Item key={e.path} entry={e} cover={covers.current.get(e.path)} list={view === "list"} onInspect={props.onInspect} onConvert={props.onConvert} remove={remove} />
          ))}
        </ul>
      )}
      {result && result.warnings.length > 0 && (
        <details className="fold library-note">
          <summary>Skipped locations and files</summary>
          <ul className="muted">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      {result && <p className="muted library-note">Results stay here until you press Refresh. New outputs appear after refreshing.</p>}
    </>
  );

  return (
    <div className="screen">
      <section className="card library" aria-labelledby="library-title">
        <div className="library-head">
          <h2 id="library-title">
            <Icon name="library" />
            Library
            {result && <span className="count">{entries.length}</span>}
          </h2>
          <div className="library-ctl">
            {host && folder && (
              <span className="library-folder">
                <PathLine path={folder} />
              </span>
            )}
            {(platform !== null || error !== null) && !empty && !refused && (
              <button type="button" className="small" ref={refreshRef} disabled={busy} onClick={() => void refresh()}>
                <Icon name="refresh" />
                Refresh
              </button>
            )}
            {host && folder && (
              <button type="button" className="small" disabled={busy} onClick={() => void choose()}>
                <Icon name="folder" />
                Choose folder…
              </button>
            )}
            {platform !== null && !empty && !refused && <div className="library-views">
              <button type="button" className="small icon-only" aria-pressed={view === "cards"} aria-label="Card view" title="Card view" onClick={() => setView("cards")}>
                <Icon name="grid" />
              </button>
              <button type="button" className="small icon-only" aria-pressed={view === "list"} aria-label="List view" title="List view" onClick={() => setView("list")}>
                <Icon name="list" />
              </button>
            </div>}
          </div>
        </div>
        <div className="library-well" ref={wellRef} tabIndex={0} aria-busy={busy} aria-label="Game dumps">
          {body}
        </div>
      </section>
    </div>
  );
}

function Item(props: {
  entry: LibraryEntry;
  cover: string | undefined;
  list: boolean;
  onInspect: (e: LibraryEntry) => void;
  onConvert: (e: LibraryEntry) => void;
  remove: (e: LibraryEntry) => void;
}) {
  const { entry: e } = props;
  const n = name(e);
  const cover = props.cover ? (
    <img className="cover library-cover" src={props.cover} alt="" />
  ) : (
    <div className="cover none library-cover" aria-hidden="true">
      <Icon name="disc" />
    </div>
  );
  const actions = (
    <span className="library-actions">
      <button type="button" className="small icon-only" aria-label={`Inspect ${n}`} title={`Inspect ${n}`} onClick={() => props.onInspect(e)}>
        <Icon name="search" />
      </button>
      <button type="button" className="small icon-only" aria-label={`Convert ${n}`} title={`Convert ${n}`} onClick={() => props.onConvert(e)}>
        <Icon name="convert" />
      </button>
      <button type="button" className="small icon-only danger" aria-label={`Delete ${n}`} title={`Delete ${n}`} onClick={() => props.remove(e)}>
        <Icon name="trash" />
      </button>
    </span>
  );
  const box = <div className="library-cover-box">{cover}</div>;
  return props.list ? (
    <li className="library-row" title={e.path}>
      {cover}
      <div className="library-text">
        <div className="library-name">{n}</div>
        <div className="library-sub muted">
          {e.title_id}
        </div>
      </div>
      <FormatPill kind={e.kind} />
      <div className="library-path">
        <PathLine path={e.path} />
      </div>
      {actions}
    </li>
  ) : (
    <li className="library-card" title={e.path}>
      {box}
      <div>
        <div className="library-name">{n}</div>
        <div className="library-sub muted">{e.title_id}</div>
      </div>
      <div className="library-foot">
        <FormatPill kind={e.kind} />
        {actions}
      </div>
    </li>
  );
}
