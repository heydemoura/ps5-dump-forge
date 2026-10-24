// The Storage tab: a two-way view switch (Library | File explorer) first in the head of the
// view it picks. Both views stay mounted, so a list or a folder survives a switch;
// on a computer they share one chosen folder. The view lasts until the app closes.

import { useEffect, useRef, useState } from "react";

import { ViewSwitch, type SourceSelection } from "./common";
import { Files } from "./Files";
import { useMessages } from "./i18n";
import { Library } from "./Library";

type View = "library" | "files";

export type HandOff = (e: { path: string; kind: SourceSelection["kind"] }) => void;

export function Storage(props: { visible: boolean; onEdit: HandOff; onConvert: HandOff }) {
  const t = useMessages().storage;
  const [view, setView] = useState<View>("files");
  const [folder, setFolder] = useState<string | null>(null);
  const screen = useRef<HTMLDivElement>(null);
  // Each view's head has its own copy of the switch and the old one is hidden on a switch, so
  // focus that was on a switch moves to the shown copy's checked option (keys and clicks alike).
  const refocus = useRef(false);
  const pick = (v: View) => {
    refocus.current = !!document.activeElement?.closest(".view-switch");
    setView(v);
  };
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    screen.current?.querySelector<HTMLElement>(":scope > div:not([hidden]) .view-switch [role=radio][aria-checked=true]")?.focus();
  }, [view]);
  // One switch, rendered first in the shown view's card head (each view owns its card).
  const switcher = (
    <ViewSwitch
      label={t.views}
      value={view}
      onChange={pick}
      options={[
        // Under 400px the labels hide (still the options' names): fr/es/pt overflow a phone's card.
        { id: "library", icon: "disc", label: <span className="view-label">{t.library}</span> },
        { id: "files", icon: "folder", label: <span className="view-label">{t.files}</span> },
      ]}
    />
  );
  return (
    <div className="screen storage" ref={screen}>
      <div hidden={view !== "library"}>
        <Library
          visible={props.visible && view === "library"}
          folder={folder}
          onFolder={setFolder}
          onEdit={props.onEdit}
          onConvert={props.onConvert}
          switcher={switcher}
        />
      </div>
      <div hidden={view !== "files"}>
        <Files
          visible={props.visible && view === "files"}
          folder={folder}
          onFolder={setFolder}
          onEdit={props.onEdit}
          onConvert={props.onConvert}
          switcher={switcher}
        />
      </div>
    </div>
  );
}
