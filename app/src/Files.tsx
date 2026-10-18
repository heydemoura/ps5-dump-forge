// The Storage tab's File explorer: one folder at a time, drawn as Edit's explorer, where every
// action happens at once (no pending list, no Apply): delete (after the shared question),
// rename in place, move to a folder the picker chooses, and open a folder or an image/archive
// in Edit or Convert. On a computer it browses the chosen folder (shared with the Library; Up
// stops there), until one is chosen the home folder (the app; not shared, so the Library doesn't
// scan it) or the server's roots (the http build); on the PS5 the server's browse roots. Links
// are listed and can be opened, never changed. The folder is listed again after each action and
// whenever the view shows.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { api, errorText, pick, prettyBytes, runtimePlatform, web, type DirEntry, type DirListing, type RuntimePlatform } from "./api";
import {
  ARCHIVE_EXTENSIONS,
  basename,
  CardHead,
  ChooseMenu,
  dirname,
  Dots,
  IMAGE_EXTENSIONS,
  isWithin,
  joinPath,
  notifyDeleted,
  onDeleted,
  PathLine,
  type SourceSelection,
} from "./common";
import { confirmDelete, type DeletedFile } from "./delete";
import { MAX_ROWS, NameInput } from "./Edit";
import { useMessages } from "./i18n";
import { Icon } from "./icons";
import type { HandOff } from "./Storage";

/** One folder of the way down from the explorer's root; `path` null: the PS5's browse roots. */
interface Crumb {
  path: string | null;
  name: string;
  /** The row it was opened from (a link's own path; `path` is then its target), focused on the way back up. */
  row?: string;
}

const extOf = (name: string) => {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
};

/** What Edit and Convert would open a file as, by extension; null: not a source. */
function sourceKind(name: string): SourceSelection["kind"] | null {
  const ext = extOf(name);
  if (IMAGE_EXTENSIONS.includes(ext)) return ext as SourceSelection["kind"];
  if (!ARCHIVE_EXTENSIONS.includes(ext)) return null;
  if (ext === "001") return extOf(name.slice(0, -4)) === "zip" ? "zip" : "7z";
  return ext === "z01" ? "zip" : (ext as SourceSelection["kind"]);
}

function deletedFile(name: string): DeletedFile {
  const kind = sourceKind(name);
  return kind === null ? "file" : ["zip", "7z", "rar"].includes(kind) ? "archive" : "image";
}

/** Core gives a link's resolved target as its `path`, which can name another row of the same
 * folder; a link row keeps its own path (unique; links get no actions) and its `target`, where
 * opening it goes. */
const rowsOf = (l: DirListing): DirListing => ({
  ...l,
  entries: l.entries.map((e) =>
    e.link && l.path !== null ? { ...e, path: joinPath(l.path, e.name), target: e.path } : e,
  ),
});

export function Files(props: {
  visible: boolean;
  /** The folder both Storage views share (computer). */
  folder: string | null;
  onFolder: (folder: string) => void;
  onEdit: HandOff;
  onConvert: HandOff;
}) {
  const t = useMessages().storage;
  const tabs = useMessages().app;
  const [platform, setPlatform] = useState<RuntimePlatform | null>(null);
  // The app's start before a folder is chosen: undefined while asked, null when there is none.
  const [home, setHome] = useState<string | null | undefined>(undefined);
  const [trail, setTrail] = useState<Crumb[]>([]);
  // The listing and the trail it belongs to (another folder's shows as loading).
  // `n`: the load that answered, so focus waits for the listing it was asked against.
  const [listed, setListed] = useState<{ key: string; n: number; listing: DirListing } | null>(null);
  const [listError, setListError] = useState<{ key: string; n: number; text: string } | null>(null);
  const [filter, setFilter] = useState("");
  const [focus, setFocus] = useState(0);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actError, setActError] = useState<{ lead: string; text: string } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const seq = useRef(0);
  const acting = useRef(false);
  /** The row to focus ("" = the first) once load `after` (or a later one) has rendered. */
  const want = useRef<{ path: string; after: number } | null>(null);
  const focusAfterLoad = (path: string) => (want.current = { path, after: seq.current + 1 });
  const grid = useRef<HTMLDivElement>(null);

  const lookup = () =>
    runtimePlatform().then(
      (p) => {
        setLookupError(null);
        setPlatform(p);
      },
      (e) => setLookupError(errorText(e)),
    );
  useEffect(() => void lookup(), []);
  useEffect(() => {
    if (!web) api.homeFolder().then(setHome, () => setHome(null));
  }, []);

  // The root: the server's roots (named at render; the PS5, or a computer's http build before a
  // folder is chosen), the chosen folder, else the app's home; a new one starts the trail again.
  // undefined: not known yet (or none), so no trail.
  const root: string | null | undefined =
    platform === "ps5" ? null : platform === "host" ? (props.folder ?? (web ? null : (home ?? undefined))) : undefined;
  useEffect(() => {
    setTrail(root === undefined ? [] : [{ path: root, name: root === null ? "" : basename(root) }]);
    setFilter("");
  }, [root]);
  const crumbName = (c: Crumb) => (c.path === null ? t.roots : c.name);

  const key = trail.map((c) => c.path ?? "").join("\0");
  const here = trail.length > 0 ? trail[trail.length - 1] : null;

  const load = async () => {
    if (!here) return;
    const mine = ++seq.current;
    const at = key;
    try {
      const listing = rowsOf(await api.listDir(here.path));
      if (mine !== seq.current) return;
      setListed({ key: at, n: mine, listing });
      setListError(null);
    } catch (e) {
      if (mine !== seq.current) return;
      setListError({ key: at, n: mine, text: errorText(e) });
    }
  };
  const loadRef = useRef(load);
  loadRef.current = load;
  const trailRef = useRef(trail);
  trailRef.current = trail;

  // Listed whenever the folder changes or the view shows (jobs may have written meanwhile).
  useEffect(() => {
    if (props.visible && trail.length > 0) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visible, key]);

  // Deleted, renamed or moved elsewhere (Edit, the Library): leave a folder that went, else list again.
  useEffect(
    () =>
      onDeleted((gone) => {
        if (acting.current) return;
        const s = trailRef.current;
        const i = s.findIndex((c, k) => k > 0 && c.path !== null && isWithin(c.path, gone));
        if (i > 0) setTrail(s.slice(0, i));
        else void loadRef.current();
      }),
    [],
  );

  const listing = listed && listed.key === key ? listed.listing : null;
  const error = listError && listError.key === key ? listError.text : null;
  const roots = here !== null && here.path === null; // the PS5's browse roots: nothing to change
  const query = filter.trim().toLowerCase();
  const all = listing?.entries ?? [];
  const entries = query ? all.filter((e) => e.name.toLowerCase().includes(query)) : all;
  const shown = entries.slice(0, MAX_ROWS);
  const atState = Math.min(focus, Math.max(shown.length - 1, 0));

  const go = (next: Crumb[], focusPath: string | null) => {
    setTrail(next);
    setFilter("");
    setFocus(0);
    setRenaming(null);
    setNotice(null);
    setActError(null);
    focusAfterLoad(focusPath ?? "");
  };
  const open = (e: DirEntry) => e.dir && go([...trail, { path: e.target ?? e.path, name: e.name, row: e.path }], null);
  const up = () => trail.length > 1 && go(trail.slice(0, -1), here ? (here.row ?? here.path) : null);

  // Focus the row asked for, once the listing it is in has rendered.
  const shownN = listing ? listed?.n : error ? listError?.n : undefined;
  useEffect(() => {
    if (!props.visible || want.current === null || shownN === undefined || shownN < want.current.after) return;
    const w = want.current.path;
    want.current = null;
    if (shown.length === 0) {
      grid.current?.focus();
      return;
    }
    const i = Math.max(w === "" ? 0 : shown.findIndex((e) => e.path === w), 0);
    setFocus(i);
    grid.current?.querySelectorAll<HTMLElement>("[role=row][data-path]")[i]?.focus();
  });

  // One action at a time; the folder is listed again before the others hear of it.
  const act = async (lead: string, run: () => Promise<string | null>, gone: string | null) => {
    if (acting.current) return;
    acting.current = true;
    try {
      const done = await run();
      if (done === null) return;
      setActError(null);
      setNotice(done);
      // The folder shown now: the user may have moved on while the action ran.
      await loadRef.current();
      if (gone) notifyDeleted(gone);
    } catch (e) {
      setNotice(null);
      setActError({ lead, text: errorText(e) });
    } finally {
      acting.current = false;
    }
  };
  const nextOf = (e: DirEntry) => {
    const i = shown.findIndex((x) => x.path === e.path);
    return (shown[i + 1] ?? shown[i - 1])?.path ?? "";
  };
  const remove = (e: DirEntry) =>
    act(
      t.cantDelete,
      async () => {
        if (!(await confirmDelete(e.path, e.dir, deletedFile(e.name)))) return null;
        await api.deletePath(e.path);
        focusAfterLoad(nextOf(e));
        return t.deleted(e.path);
      },
      e.path,
    );
  const renamed = (e: DirEntry, name: string | null) => {
    setRenaming(null);
    want.current = { path: e.path, after: 0 };
    if (name === null) return;
    const to = joinPath(dirname(e.path), name);
    void act(
      t.cantRename,
      async () => {
        await api.movePath(e.path, to);
        focusAfterLoad(to);
        return t.renamed(to);
      },
      e.path,
    );
  };
  const move = (e: DirEntry) =>
    act(
      t.cantMove,
      async () => {
        const dir = await pick({ directory: true, title: t.moveTitle(e.name), start: here?.path ?? undefined });
        if (dir === null) return null;
        if (dirname(e.path) === dir) throw new Error(t.sameFolder);
        const to = joinPath(dir, e.name);
        await api.movePath(e.path, to);
        focusAfterLoad(nextOf(e));
        return t.moved(to);
      },
      e.path,
    );
  const choose = async () => {
    const p = await pick({ directory: true, title: t.pickTitle, start: root ?? undefined });
    if (p === null) return;
    if (p === root) go([{ path: p, name: basename(p) }], null);
    props.onFolder(p);
  };
  const refresh = () => {
    setNotice(null);
    setActError(null);
    if (!platform) void lookup();
    else void load();
  };
  const handOff = (to: HandOff, e: DirEntry) => {
    const kind = e.dir ? "folder" : sourceKind(e.name);
    if (kind) to({ path: e.path, kind });
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || (e.target as HTMLElement).closest?.("[role=menu]")) return; // a row's ⋯ menu
    if ((e.target as HTMLElement).tagName === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;
    const from = (e.target as HTMLElement).closest?.("[role=row][data-path]") as HTMLElement | null;
    const fromAt = from ? shown.findIndex((x) => x.path === from.dataset.path) : -1;
    const at = fromAt >= 0 ? fromAt : atState;
    const row = shown[at];
    const changeable = row && !roots && !row.link && !row.mounted;
    const moveTo = (i: number) => {
      e.preventDefault();
      if (shown.length === 0) return;
      const n = Math.min(Math.max(i, 0), shown.length - 1);
      setFocus(n);
      grid.current?.querySelectorAll<HTMLElement>("[role=row][data-path]")[n]?.focus();
    };
    if (e.key === "ArrowDown") moveTo(at + 1);
    else if (e.key === "ArrowUp" && !e.altKey) moveTo(at - 1);
    else if (e.key === "Home") moveTo(0);
    else if (e.key === "End") moveTo(shown.length - 1);
    else if (e.key === "PageDown") moveTo(at + 10);
    else if (e.key === "PageUp") moveTo(at - 10);
    else if (e.key === "Enter" && row) {
      e.preventDefault();
      open(row);
    } else if (e.key === "Backspace" || (e.key === "ArrowUp" && e.altKey)) {
      e.preventDefault();
      up();
    } else if (e.key === "F2" && changeable) {
      e.preventDefault();
      setRenaming(row.path);
    } else if (e.key === "Delete" && changeable) {
      e.preventDefault();
      void remove(row);
    }
  };

  const host = platform === "host";
  // A computer with no folder to show (no home, or the start can't be listed): choose one.
  const unrooted = host && !props.folder && (root === undefined ? home === null : !!error && trail.length === 1);
  if (unrooted)
    return (
      <section className="card explorer files bare" aria-labelledby="files-title">
        <CardHead icon="folder" title={t.title} id="files-title" />
        {error && (
          <p className="note-line block" role="alert">
            <Icon name="alert" />
            <span>
              {t.cantList} <span className="backend">{error}</span>
            </span>
          </p>
        )}
        <div className="empty library-empty">
          <span className="empty-icon">
            <Icon name="folder" />
          </span>
          <p className="empty-title">{t.pickPrompt}</p>
          <div className="row center">
            <button type="button" className="primary" onClick={() => void choose()}>
              <Icon name="folder" />
              {t.choose}
            </button>
          </div>
        </div>
      </section>
    );

  // Where the backend runs isn't known (the server didn't answer): Refresh asks again.
  if (!platform && lookupError)
    return (
      <section className="card explorer files bare" aria-labelledby="files-title">
        <CardHead icon="folder" title={t.title} id="files-title">
          <button type="button" className="small" onClick={refresh}>
            <Icon name="refresh" />
            {t.refresh}
          </button>
        </CardHead>
        <p className="note-line block" role="alert">
          <Icon name="alert" />
          <span className="backend">{lookupError}</span>
        </p>
      </section>
    );

  const dirs = all.filter((e) => e.dir).length;
  const count = !listing
    ? ""
    : entries.length > MAX_ROWS
      ? t.firstOf(MAX_ROWS, entries.length)
      : query
        ? t.matches(entries.length)
        : t.inFolder(dirs, all.length - dirs);

  return (
    <section className="card explorer files" aria-labelledby="files-title">
      <CardHead icon="folder" title={t.title} id="files-title">
        {host && root && (
          <span className="library-folder">
            <PathLine path={root} />
          </span>
        )}
        <button type="button" className="small" onClick={refresh}>
          <Icon name="refresh" />
          {t.refresh}
        </button>
        {host && (
          <button type="button" className="small" onClick={() => void choose()}>
            <Icon name="folder" />
            {t.choose}
          </button>
        )}
      </CardHead>
      {!roots && trail.length > 0 && (
        <p className="note-line explorer-note">
          <Icon name="info" />
          <span>{t.atOnce}</span>
        </p>
      )}
      <div className="row nowrap explorer-nav">
        <button className="small" onClick={up} disabled={trail.length < 2} title={t.upTip}>
          <Icon name="up" />
          {t.up}
        </button>
        <nav className="crumbs grow" aria-label={t.location}>
          {trail.map((c, i) => {
            const last = i === trail.length - 1;
            return (
              <span key={`${i}:${c.path ?? ""}`} className="crumb">
                {i > 0 && (
                  <span className="muted" aria-hidden="true">
                    /
                  </span>
                )}
                {last ? (
                  <span className="here" aria-current="location">
                    {crumbName(c)}
                  </span>
                ) : (
                  <button type="button" className="link" title={c.path ?? undefined} onClick={() => go(trail.slice(0, i + 1), trail[i + 1].row ?? trail[i + 1].path)}>
                    {crumbName(c)}
                  </button>
                )}
              </span>
            );
          })}
        </nav>
      </div>
      {actError && (
        <p className="note-line block" role="alert">
          <Icon name="alert" />
          <span>
            {actError.lead} <span className="backend">{actError.text}</span>
          </span>
        </p>
      )}
      {notice && (
        <p className="muted files-notice" role="status">
          {notice}
        </p>
      )}
      {listing?.truncated && (
        <p className="note-line warn explorer-note">
          <Icon name="warn" />
          <span>{t.truncated}</span>
        </p>
      )}
      <div className="row nowrap filter">
        <input
          type="search"
          className="grow"
          placeholder={t.filter}
          aria-label={t.filterLabel}
          dir="auto"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setFocus(0);
          }}
          spellCheck={false}
        />
        <span className="muted count-text" role="status">
          {count}
        </span>
      </div>
      <div className="explorer-well">
        {!listing && !error ? (
          <div className="library-busy" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <span>
              {here && crumbName(here)}
              <Dots />
            </span>
          </div>
        ) : (
          <div
            role="grid"
            ref={grid}
            className={`xgrid files${roots ? "" : " editable"}`}
            aria-label={t.title}
            aria-rowcount={shown.length + 1}
            tabIndex={shown.length === 0 ? 0 : undefined}
            onKeyDown={onKey}
          >
            <div role="row" className="xrow head" aria-rowindex={1}>
              <span role="columnheader" className="xname">
                {t.name}
              </span>
              <span role="columnheader" className="xsize">
                {t.size}
              </span>
              <span role="columnheader" className="xact" />
            </div>
            {!error &&
              shown.map((e, i) => {
                const mine = i === atState ? 0 : -1;
                const changeable = !roots && !e.link && !e.mounted;
                const source = !roots && !e.link && (e.dir || sourceKind(e.name) !== null);
                const editing = renaming === e.path;
                return (
                  <div
                    key={e.name}
                    role="row"
                    data-path={e.path}
                    data-dir={e.dir ? "1" : undefined}
                    aria-rowindex={i + 2}
                    tabIndex={mine}
                    className={`xrow${e.dir ? " dir" : ""}`}
                    onFocus={(ev) => ev.target === ev.currentTarget && setFocus(i)}
                    onDoubleClick={() => !editing && open(e)}
                  >
                    <span role="gridcell" className="xname">
                      <Icon name={e.dir ? "folder" : sourceKind(e.name) ? "archive" : "file"} />
                      {editing ? (
                        <NameInput
                          initial={e.name}
                          label={t.rename(e.name)}
                          taken={(n) => all.some((x) => x.name === n)}
                          onDone={(n) => renamed(e, n)}
                        />
                      ) : (
                        <span className="xlabel">{e.name}</span>
                      )}
                      {e.link && (
                        <span className="tag xmark" title={t.linkTip}>
                          {t.link}
                        </span>
                      )}
                      {e.mounted && (
                        <span className="tag xmark" title={t.mountedTip}>
                          {t.mounted}
                        </span>
                      )}
                    </span>
                    <span role="gridcell" className="xsize">
                      {e.size !== null && !e.dir ? prettyBytes(e.size) : ""}
                    </span>
                    <span role="gridcell" className="xact">
                      {changeable && !editing && (
                        <>
                          <button type="button" className="small icon-only xbtn" tabIndex={mine} aria-label={t.rename(e.name)} title={t.renameTip} onClick={() => setRenaming(e.path)}>
                            <Icon name="pencil" />
                          </button>
                          <button type="button" className="small icon-only xbtn" tabIndex={mine} aria-label={t.move(e.name)} title={t.moveTip} onClick={() => void move(e)}>
                            <Icon name="move" />
                          </button>
                          <button type="button" className="small icon-only xbtn danger" tabIndex={mine} aria-label={t.remove(e.name)} title={t.removeTip} onClick={() => void remove(e)}>
                            <Icon name="trash" />
                          </button>
                        </>
                      )}
                      {source && !editing && (
                        <ChooseMenu
                          className="small icon-only xbtn"
                          label={<Icon name="dots" />}
                          buttonLabel={t.more(e.name)}
                          menuLabel={t.more(e.name)}
                          tabIndex={mine}
                          items={[
                            { id: "edit", icon: "pencil", label: tabs.edit },
                            { id: "convert", icon: "convert", label: tabs.convert },
                          ]}
                          onChoose={(what) => handOff(what === "edit" ? props.onEdit : props.onConvert, e)}
                        />
                      )}
                      {e.dir && (
                        <button type="button" className="small icon-only xopen" tabIndex={-1} aria-label={t.open(e.name)} title={t.open(e.name)} onClick={() => open(e)}>
                          <Icon name="chevron" />
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
          </div>
        )}
        {error ? (
          <p className="note-line block empty-note" role="alert">
            <Icon name="alert" />
            <span>
              {t.cantList} <span className="backend">{error}</span>
            </span>
          </p>
        ) : (
          listing &&
          shown.length === 0 && (
            <p className="muted empty-note">{query ? t.noMatch(filter.trim()) : roots ? t.noRoots : t.emptyFolder}</p>
          )
        )}
      </div>
    </section>
  );
}
