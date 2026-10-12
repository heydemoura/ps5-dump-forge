// The one "Delete this folder/image?" question, shared by Inspect and the Library. It only
// asks; the caller makes the api call and owns the errors and the operation guards.

import { Modal, openOverlay } from "./common";
import { useMessages } from "./i18n";
import { Icon } from "./icons";

/** Asks before deleting `path` for good; true: Yes. Two buttons, No first and focused. */
export function confirmDelete(path: string, folder: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    let yes = false;
    openOverlay(
      (close) => (
        <DeleteDialog
          path={path}
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

function DeleteDialog(props: { path: string; folder: boolean; close: () => void; onYes: () => void }) {
  const t = useMessages().delete;
  return (
    <Modal
      close={props.close}
      className="modal card"
      role="alertdialog"
      labelledBy="del-title"
      describedBy="del-text"
    >
      <div className="modal-head">
        <span className="head-icon warn">
          <Icon name="trash" />
        </span>
        <h2 id="del-title">{t.title(props.folder)}</h2>
      </div>
      <div id="del-text">
        <p className="out-box path">{props.path}</p>
        <p className="muted">{t.text(props.folder)}</p>
      </div>
      <div className="row end">
        <button autoFocus onClick={props.close}>
          {t.no}
        </button>
        <button className="danger" onClick={props.onYes}>
          {t.yes}
        </button>
      </div>
    </Modal>
  );
}
