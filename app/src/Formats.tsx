// About: what the app is and (http build) how to reach the page at its own address, then
// one comparison table of the targets and the plain folder (console speeds
// from ShadowMountPlus 1.7's README and release notes; the LZ4 packed folder's from its
// upstream authors, labelled as theirs), the LZ4 credits and the language selector. Nothing
// here talks to Rust.

import { useState } from "react";

import { APP_NAME, serverAddress, type Format } from "./api";
import { AddressQr, CardHead, FormatPill, Modal, openOverlay, Prose } from "./common";
import { getChoice, type Lang, LANGS, setLang, useMessages } from "./i18n";
import { Icon, type IconName } from "./icons";

export type Rating = "good" | "ok" | "bad";

/** Each rating's icon: the colour is never the only cue (its spoken prefix is a message). */
const RATING_ICON: Record<Rating, IconName> = { good: "check", ok: "minus", bad: "x" };

/** The table's rows in order, with each cell's rating; the words are messages (`rows`). */
const ROWS: { kind: Format; rates: [Rating, Rating] }[] = [
  { kind: "pkg", rates: ["good", "good"] },
  { kind: "lz4", rates: ["good", "good"] },
  { kind: "ffpkg", rates: ["good", "ok"] },
  { kind: "exfat", rates: ["good", "ok"] },
  { kind: "ffpfs", rates: ["good", "ok"] },
  { kind: "ffpfsc", rates: ["bad", "good"] },
  { kind: "folder", rates: ["good", "ok"] },
];

export type Row = { tagline: string; cells: [string, string] };

/** The header's address button: the big QR code and where to open the page, in a dialog (only
 * the http build has an address to show). */
export function openConnect() {
  openOverlay((close) => <Connect close={close} />);
}

function Connect({ close }: { close: () => void }) {
  const t = useMessages().formats;
  const address = serverAddress();
  return (
    <Modal close={close} className="modal card connect-modal" labelledBy="connect-title">
      <div className="modal-head">
        <span className="head-icon">
          <Icon name="power" />
        </span>
        <h2 id="connect-title">{t.howToConnect}</h2>
      </div>
      <div className="connect">
        <AddressQr size={240} />
        <p className="connect-text">{t.connectText(<span className="path url">http://{address}</span>)}</p>
      </div>
      <div className="row end">
        <button type="button" autoFocus onClick={close}>
          {t.close}
        </button>
      </div>
    </Modal>
  );
}

export function Formats() {
  const t = useMessages().formats;
  const address = serverAddress();
  return (
    <div className="screen">
      {/* The PS5 page: About and How to connect side by side; the app, with no address, About only. */}
      <div className={address ? "about-row" : undefined}>
        <section className="card" aria-labelledby="f-about">
          <CardHead icon="info" title={t.about} id="f-about">
            <LanguagePicker />
          </CardHead>
          <p className="about-text">{t.aboutText}</p>
          <ul className="about-text features">
            {t.features.map(([name, what]) => (
              <li key={name}>
                <b>{name}</b> <Prose text={what} />
              </li>
            ))}
          </ul>
        </section>
        {address && (
          <section className="card about-connect" aria-labelledby="f-connect">
            <CardHead title={t.connectAny} id="f-connect" />
            <AddressQr size={200} />
            <p className="about-text">{t.useAddress(<span className="path url">http://{address}</span>)}</p>
          </section>
        )}
      </div>

      <section className="card formats-card" aria-labelledby="f-title">
        <CardHead icon="table" title={t.compare} id="f-title" />
        <div className="table-wrap" tabIndex={0} role="region" aria-label={t.compareLabel}>
          <table className="compare">
            <thead>
              <tr>
                <th scope="col">{t.format}</th>
                {t.columns.map((c) => (
                  <th scope="col" key={c}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.kind}>
                  <th scope="row">
                    <FormatPill kind={r.kind} />
                    <span className="tagline">{t.rows[r.kind].tagline}</span>
                  </th>
                  {r.rates.map((rate, i) => (
                    <td key={i}>
                      <span className={`chip ${rate}`}>
                        <Icon name={RATING_ICON[rate]} />
                        <span>
                          <span className="visually-hidden">{t.rating[rate]}: </span>
                          {t.rows[r.kind].cells[i]}
                        </span>
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="credits">
          <p className="muted">{t.upstream(APP_NAME)}</p>
          <p className="muted">
            {t.bundled} <span className="path">https://github.com/drakmor/ampr_emu</span>
          </p>
          <p className="muted">
            {t.lazy} <span className="path">https://github.com/Nazky/Lazy_AMPR</span>
          </p>
          <p className="muted">{t.unrar}</p>
        </div>
      </section>
    </div>
  );
}

type Choice = Lang | "system";

/** The UI language, right in the About card's header: the system's, or one chosen here (kept by
 * i18n.ts). A native select drawn as a small pill (DESIGN.md), each language named in its own
 * words; it holds any number of them. */
function LanguagePicker() {
  const t = useMessages().formats;
  // Local too: the store switches only once the language's file has loaded.
  const [choice, setChoice] = useState<Choice>(getChoice() ?? "system");
  const choose = (c: Choice) => {
    setChoice(c);
    // A language file that can't load leaves the language as it was: so does the picker.
    setLang(c === "system" ? null : c).catch(() => setChoice(getChoice() ?? "system"));
  };
  return (
    <label className="head-lang">
      <span>{t.language}</span>
      <select
        id="ui-language"
        className="lang-select"
        value={choice}
        onChange={(e) => choose(e.target.value as Choice)}
      >
        <option value="system">{t.system}</option>
        {(Object.entries(LANGS) as [Lang, string][]).map(([l, name]) => (
          <option key={l} value={l} lang={l}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
