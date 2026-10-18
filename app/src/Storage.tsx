// The Storage tab: a two-way view switch (Library | File explorer) at the end of its own row,
// over the view it picks. Both views stay mounted, so a list or a folder survives a switch;
// on a computer they share one chosen folder. The view lasts until the app closes.

import { useRef, useState, type KeyboardEvent } from "react";

import type { SourceSelection } from "./common";
import { Files } from "./Files";
import { useMessages } from "./i18n";
import { Icon, type IconName } from "./icons";
import { Library } from "./Library";

type View = "library" | "files";

export type HandOff = (e: { path: string; kind: SourceSelection["kind"] }) => void;

export function Storage(props: { visible: boolean; onEdit: HandOff; onConvert: HandOff }) {
  const t = useMessages().storage;
  const [view, setView] = useState<View>("files");
  const [folder, setFolder] = useState<string | null>(null);
  return (
    <div className="screen storage">
      <div className="storage-bar">
        <ViewSwitch
          label={t.views}
          value={view}
          onChange={setView}
          options={[
            { id: "library", icon: "disc", label: t.library },
            { id: "files", icon: "folder", label: t.files },
          ]}
        />
      </div>
      <div hidden={view !== "library"}>
        <Library
          visible={props.visible && view === "library"}
          folder={folder}
          onFolder={setFolder}
          onEdit={props.onEdit}
          onConvert={props.onConvert}
        />
      </div>
      <div hidden={view !== "files"}>
        <Files
          visible={props.visible && view === "files"}
          folder={folder}
          onFolder={setFolder}
          onEdit={props.onEdit}
          onConvert={props.onConvert}
        />
      </div>
    </div>
  );
}

/** A small pill radiogroup (not tabs: the screen tabs are the header's). One tab stop; the
 * arrow keys, Home and End move and choose. */
function ViewSwitch<T extends string>(props: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { id: T; icon: IconName; label: string }[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const ids = props.options.map((o) => o.id);
  const onKey = (e: KeyboardEvent) => {
    const i = ids.indexOf(props.value);
    // Right-to-left, the next option is to the left.
    const rtl = document.documentElement.dir === "rtl";
    const fwd = e.key === "ArrowDown" || e.key === (rtl ? "ArrowLeft" : "ArrowRight");
    const back = e.key === "ArrowUp" || e.key === (rtl ? "ArrowRight" : "ArrowLeft");
    const n = fwd ? (i + 1) % ids.length : back ? (i - 1 + ids.length) % ids.length : e.key === "Home" ? 0 : e.key === "End" ? ids.length - 1 : -1;
    if (n < 0) return;
    e.preventDefault();
    props.onChange(ids[n]);
    box.current?.querySelectorAll<HTMLElement>("[role=radio]")[n]?.focus();
  };
  return (
    <div className="seg view-switch" role="radiogroup" aria-label={props.label} ref={box} onKeyDown={onKey}>
      {props.options.map((o) => {
        const on = o.id === props.value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className={`seg-opt view-${o.id}${on ? " on" : ""}`}
            onClick={() => props.onChange(o.id)}
          >
            <Icon name={o.icon} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
