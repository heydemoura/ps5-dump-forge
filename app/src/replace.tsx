// The one "N items already exist there: replace them?" question, shared by File Transfer, the
// phone upload, Edit's Extract and the File explorer's Rename and Move to. It only asks; the
// caller sends `replace` (core refuses a file onto a folder and the like itself).

import { api, type ConvertRequest } from "./api";
import { basename, Modal, openOverlay } from "./common";
import { useMessages } from "./i18n";
import { Icon } from "./icons";
import { readable } from "./peers";

/** Names listed in full; the rest are counted. */
const SHOWN = 10;

/** An extract or a transfer (File Transfer's Start, Edit's Extract, a failed job's Retry) asks
 * once about names already in its output: the request to start, `replace` set only after
 * Replace (a retry asks again, whatever the first run had), or null on Cancel or once `still()`
 * says the moment passed. */
export async function askReplace(request: ConvertRequest, still: () => boolean = () => true): Promise<ConvertRequest | null> {
  const plain: ConvertRequest = { ...request, replace: undefined };
  const there = await api.existingTargets(plain);
  if (!still()) return null;
  if (there.length === 0) return plain;
  if (!(await confirmReplace(there.map(basename), plain.output)) || !still()) return null;
  return { ...plain, replace: true };
}

/** Asks before replacing `names` (as they are in `folder`) for good; true: Replace. Cancel is
 * first and focused; Escape and a click outside cancel. */
export function confirmReplace(names: string[], folder: string): Promise<boolean> {
  return new Promise((resolve) => {
    let yes = false;
    openOverlay(
      (close) => (
        <ReplaceDialog
          names={names}
          folder={folder}
          close={close}
          onYes={() => {
            yes = true;
            close();
          }}
        />
      ),
      () => resolve(yes),
    );
  });
}

function ReplaceDialog(props: { names: string[]; folder: string; close: () => void; onYes: () => void }) {
  const t = useMessages().replace;
  const shown = props.names.slice(0, SHOWN);
  const rest = props.names.length - shown.length;
  return (
    <Modal close={props.close} className="modal card" role="alertdialog" labelledBy="rp-title" describedBy="rp-in rp-text">
      <div className="modal-head">
        <span className="head-icon warn">
          <Icon name="warn" />
        </span>
        <h2 id="rp-title">{t.title(props.names.length)}</h2>
      </div>
      <div>
        <p id="rp-in" className="conflict-in">
          {t.inFolder(
            <span className="path" dir="ltr">
              {readable(props.folder)}
            </span>,
          )}
        </p>
        <ul className="rows path fold-box conflict-names" tabIndex={0} aria-label={t.title(props.names.length)}>
          {shown.map((n) => (
            <li key={n} dir="ltr">
              {n}
            </li>
          ))}
          {rest > 0 && <li className="muted">{t.more(rest)}</li>}
        </ul>
        <p id="rp-text" className="muted">
          {t.text}
        </p>
      </div>
      <div className="row end">
        <button autoFocus onClick={props.close}>
          {t.cancel}
        </button>
        <button className="danger" onClick={props.onYes}>
          {t.replace}
        </button>
      </div>
    </Modal>
  );
}
