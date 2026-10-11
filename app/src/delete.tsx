// The one "Delete this folder/image?" question, shared by Inspect and the Library. It only
// asks; the caller makes the api call and owns the errors and the operation guards.

import { Modal, openOverlay } from "./common";
import { Icon } from "./icons";

/** Asks before deleting `path` for good; true: Yes. Two buttons, No first and focused. */
export function confirmDelete(path: string, folder: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    let yes = false;
    openOverlay(
      (close) => (
        <Modal
          close={close}
          className="modal card"
          role="alertdialog"
          labelledBy="del-title"
          describedBy="del-text"
        >
          <div className="modal-head">
            <span className="head-icon warn">
              <Icon name="trash" />
            </span>
            <h2 id="del-title">Delete this {folder ? "folder" : "image"}?</h2>
          </div>
          <div id="del-text">
            <p className="out-box path">{path}</p>
            <p className="muted">
              {folder ? "The folder and everything in it" : "The image file"} will be deleted for
              good: no Trash, no undo. If deleting stops part way, some of it may already be gone.
            </p>
          </div>
          <div className="row end">
            <button autoFocus onClick={close}>
              No
            </button>
            <button
              className="danger"
              onClick={() => {
                yes = true;
                close();
              }}
            >
              Yes, delete
            </button>
          </div>
        </Modal>
      ),
      () => resolve(yes),
    );
  });
}
