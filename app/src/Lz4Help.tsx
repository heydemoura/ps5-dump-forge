// The LZ4 tab's "How LZ4 works": a short how-to in a modal over the inert app (common.tsx
// `openOverlay`). Text only.


import { Modal, openOverlay } from "./common";
import { useMessages } from "./i18n";
import { Icon } from "./icons";

/** Opens the how-to; focus returns to the opener when it closes. */
export function openLz4Help() {
  openOverlay((close) => <Lz4Help close={close} />);
}

function Lz4Help({ close }: { close: () => void }) {
  const t = useMessages().lz4Help;
  return (
    <Modal close={close} className="modal card help" labelledBy="lz4-help-title">
      <div className="modal-head">
        <span className="head-icon lz4">
          <Icon name="info" />
        </span>
        <h2 id="lz4-help-title">{t.title}</h2>
      </div>
      {/* The body scrolls; the title and Close stay put. tabIndex: keys scroll it too. */}
      <div className="help-body" role="region" tabIndex={0} aria-label={t.title}>
        <p className="note-line warn">
          <Icon name="warn" />
          <span>{t.warning}</span>
        </p>
        {t.body()}
      </div>
      <div className="row end">
        <button type="button" autoFocus onClick={close}>
          {t.close}
        </button>
      </div>
    </Modal>
  );
}
