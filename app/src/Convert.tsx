// Convert: source → target format → output → Build, then one row per job below the cards.
// LZ4 asset packs (trace, pack, unpack, the in-place patch) have their own screen (Lz4.tsx).

import { useEffect, useRef, useState } from "react";

import {
  api,
  errorText,
  type ConvertRequest,
  type Format,
  type InnerFormat,
  type Inspection,
  type JobId,
  type KrakenLevel,
} from "./api";
import {
  CardHead,
  classify,
  emulatorNames,
  FormatPicker,
  isWithin,
  kindLabel,
  onDeleted,
  type SourceSelection,
  SourceCard,
} from "./common";
import { useMessages } from "./i18n";
import { Icon } from "./icons";
import { JobsCard } from "./JobList";
import type { Action, Job } from "./jobs";
import {
  DEFAULT_FFPFSC_LEVEL,
  FfpfscField,
  formatInfo,
  GenerateSwitch,
  KrakenField,
  Lead,
  OutputField,
  PkgWarning,
  startFormat,
  useOutput,
  VerifySwitch,
} from "./target";

/** The target a new source starts with. */
const DEFAULT_FORMAT: Format = "ffpkg"; // what ShadowMountPlus recommends

export function Convert(props: {
  jobs: Job[];
  dispatch: (a: Action) => void;
  /** Show the "About" tab. */
  onCompare: () => void;
  /** A game the Library opened here; each new `id` is read once. */
  selection?: SourceSelection | null;
}) {
  const t = useMessages().convert;
  const [source, setSource] = useState<string | null>(null);
  const [sourceIsImage, setSourceIsImage] = useState(false);
  const [ins, setIns] = useState<Inspection | null>(null);
  const [insError, setInsError] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [format, setFormat] = useState<Format>(DEFAULT_FORMAT);
  /** The image inside a `.ffpfsc`; kept while other targets are picked. */
  const [inner, setInner] = useState<InnerFormat>("exfat");
  /** Leave the backport libraries out; offered only for a source that has some. */
  const [removeBackport, setRemoveBackport] = useState(false);
  /** Re-read every byte instead of sampling; kept across sources and targets. */
  const [fullVerify, setFullVerify] = useState(false);
  /** The `.fpkg` compression level; kept across sources and targets. */
  const [krakenLevel, setKrakenLevel] = useState<KrakenLevel>("fast");
  /** The `.ffpfsc` zlib level, 0–9; kept across sources and targets. */
  const [ffpfscLevel, setFfpfscLevel] = useState(DEFAULT_FFPFSC_LEVEL);
  /** Install or replace the AMPR runtime in the output; on for each new source (offered only
   * where `runtimeCard` says). */
  const [runtimeOn, setRuntimeOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false); // state lags a fast double click
  /** Jobs this page started: only those scroll into view (not the ones a reload restores). */
  const started = useRef(new Set<JobId>());
  // Only the latest pick may land (an older inspect can finish last).
  const sourceSeq = useRef(0);
  const out = useOutput(format, props.jobs, setError);

  const pickSource = async (path: string, isImage: boolean) => {
    const fmt = startFormat(DEFAULT_FORMAT, path, isImage);
    setSource(path);
    setSourceIsImage(isImage);
    setFormat(fmt);
    setRemoveBackport(false);
    setRuntimeOn(true);
    setIns(null);
    setInsError(null);
    setError(null);
    out.reset(path, fmt);
    setInspecting(true);
    const seq = ++sourceSeq.current;
    try {
      const found = await api.inspect(path);
      if (seq === sourceSeq.current) setIns(found);
    } catch (e) {
      if (seq === sourceSeq.current) setInsError(errorText(e));
    } finally {
      if (seq === sourceSeq.current) setInspecting(false);
    }
  };

  // A new Library selection: the same path as a picker choice (resets the form for it).
  const pickRef = useRef(pickSource);
  pickRef.current = pickSource;
  const consumed = useRef(0);
  useEffect(() => {
    const sel = props.selection;
    if (!sel || sel.id === consumed.current) return;
    consumed.current = sel.id;
    void pickRef.current(sel.path, sel.kind !== "folder");
  }, [props.selection]);

  // Inspect or the Library deleted this source (or the folder holding it): forget it, and any late answer.
  useEffect(
    () =>
      onDeleted((gone) => {
        if (source === null || !isWithin(source, gone)) return;
        sourceSeq.current++;
        setSource(null);
        setIns(null);
        setInsError(null);
        setInspecting(false);
        setError(null);
      }),
    [source],
  );

  const pickFormat = (fmt: Format) => {
    setFormat(fmt);
    out.retarget(source, fmt);
  };

  // Removing the backport is refused when its executables' SDK was lowered (core says why).
  const removable = ins !== null && ins.backport.length > 0 && !ins.backport_blocked;
  const libs = ins ? ins.backport.length : 0;
  const emus = ins ? emulatorNames(ins) : [];

  // A packed source (LZ4 asset packs) copies as it is; core refuses what needs its packs
  // unpacked first, which the LZ4 tab does.
  const lz4 = ins?.lz4 ?? null;
  const lz4Reason = !lz4?.packed
    ? null
    : removable && removeBackport
      ? t.lz4Backport
      : lz4.runtime === "forge_trace"
        ? t.lz4Trace
        : null;

  // An AMPR title, not packed, whose runtime isn't Forge's: offer the bundled one in the output
  // (core's unpatch), none -> install, other -> replace. Hidden when an older backend doesn't
  // say which version it ships. Forge's trace runtime is swapped by core anyway.
  const shipped = lz4?.shipped_runtime_version;
  const runtimeCard =
    !!lz4 &&
    !!shipped &&
    lz4.imports_ampr &&
    !lz4.packed &&
    !lz4.manifest_error &&
    (lz4.runtime === "none" || lz4.runtime === "other");
  const installRuntime = runtimeCard && runtimeOn;

  // Build would certainly fail: say why next to it instead.
  const hard = ins ? ins.findings.filter((l) => classify(l).kind === "block") : [];
  const blockReason = insError
    ? t.unreadable
    : hard.length > 0
      ? t.blocked(hard[0], hard.length - 1)
      : lz4Reason;

  const { target, named } = out;
  const build = async () => {
    if (!source || !target || named.error || blockReason || submittingRef.current) return;
    setError(null);
    const request: ConvertRequest = {
      source,
      format,
      output: target,
      compression_threads: null,
      inner: format === "ffpfsc" ? inner : null,
      remove_backport: removable && removeBackport,
      full_verify: fullVerify,
      kraken_level: krakenLevel,
      ffpfsc_level: ffpfscLevel,
      // LZ4 tracing and unpacking start from the LZ4 tab; here only the runtime card.
      lz4: installRuntime ? "unpatch" : null,
    };
    submittingRef.current = true;
    setSubmitting(true);
    const choice = out.choiceSeq.current;
    try {
      const id = await api.startJob(request);
      started.current.add(id);
      props.dispatch({ type: "started", id, request });
      out.next(source, request.output, choice);
    } catch (e) {
      setError(errorText(e));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const sameJobs = props.jobs.filter(
    (j) => !j.result && j.request?.source === source && j.request.format === format,
  );
  // A typed name that an unfinished job is writing can't be used twice; a generated one
  // moves on to the next free name, so another Build is a second copy.
  const collides = !out.generate && sameJobs.some((j) => j.request?.output === target);
  const dupe = source !== null && sameJobs.length > 0;
  const formatWarn = ins
    ? ins.findings.filter((l) => classify(l).formats?.includes(format)).length
    : 0;
  const hasJobs = props.jobs.length > 0;

  return (
    <div className={hasJobs ? "screen with-jobs" : "screen"}>
      <div className="cols">
        <SourceCard
          path={source}
          onPick={pickSource}
          busy={inspecting}
          error={insError}
          ins={ins}
        />

        <section className="card" aria-labelledby="c-target">
          <CardHead icon="target" title={t.target} id="c-target" />
          <FormatPicker
            name="target-format"
            label={t.targetFormat}
            value={format}
            onChange={pickFormat}
            disabled={(f) => f === "folder" && source !== null && !sourceIsImage}
            reason={(f) => (f === "folder" ? t.alreadyFolder : undefined)}
          />
          <p className="muted desc">
            <Lead note={formatInfo(format)} />
          </p>
          {format === "pkg" && <PkgWarning />}
          {format === "ffpfsc" && (
            <FfpfscField
              prefix="c"
              inner={inner}
              onInner={setInner}
              level={ffpfscLevel}
              onLevel={setFfpfscLevel}
            />
          )}
          {runtimeCard && (
            <div className="field ampr-runtime">
              <label className="switch">
                <input
                  type="checkbox"
                  className="visually-hidden"
                  checked={runtimeOn}
                  onChange={(e) => setRuntimeOn(e.target.checked)}
                />
                <span className="switch-track" aria-hidden="true" />
                <span>
                  {t.runtime(lz4.runtime === "none", shipped)}
                  <span className="muted hint">
                    {lz4.runtime === "none" ? t.runtimeNone : t.runtimeOther} {t.runtimeRest}
                  </span>
                </span>
              </label>
              {installRuntime && (
                <p className="note-line warn">
                  <Icon name="warn" />
                  <span>{t.runtimeWarn(shipped)}</span>
                </p>
              )}
            </div>
          )}
          {ins && ins.backport.length > 0 && (
            <div className="field backport">
              <label className="switch">
                <input
                  type="checkbox"
                  className="visually-hidden"
                  checked={removable && removeBackport}
                  disabled={!removable}
                  onChange={(e) => setRemoveBackport(e.target.checked)}
                />
                <span className="switch-track" aria-hidden="true" />
                <span>
                  {t.removeBackport}
                  {removable && (
                    <span className="muted hint">
                      {t.removeHint(libs, emus.filter((n) => n !== "Other"), emus.includes("Other"))}
                    </span>
                  )}
                </span>
              </label>
              {ins.backport_blocked && (
                <p className="note-line warn">
                  <Icon name="warn" />
                  <span>{t.cantRemove(ins.backport_blocked.replace(/^remove backport: /, ""))}</span>
                </p>
              )}
            </div>
          )}
          {format === "pkg" && <KrakenField prefix="c" value={krakenLevel} onChange={setKrakenLevel} />}
          <VerifySwitch checked={fullVerify} onChange={setFullVerify} />
          <button className="link" onClick={props.onCompare}>
            <Icon name="table" />
            {t.compare}
          </button>
          <OutputField out={out} source={source} prefix="c" />
          <div className="build-row">
            <GenerateSwitch out={out} source={source} />
            <button
              className="primary"
              onClick={build}
              disabled={!source || !target || !!named.error || !!blockReason || submitting}
            >
              <Icon name="bolt" />
              {t.build}
            </button>
          </div>
          {(blockReason || formatWarn > 0 || dupe || error) && (
            <div className="build-notes">
              {error && <p className="bad">{error}</p>}
              {blockReason && (
                <p className="note-line block">
                  <Icon name="alert" />
                  <span>{blockReason}</span>
                </p>
              )}
              {!blockReason && formatWarn > 0 && (
                <p className="note-line warn">
                  <Icon name="warn" />
                  <span>{t.likelyFail(kindLabel(format))}</span>
                </p>
              )}
              {dupe && (
                <p className="note-line muted">
                  <Icon name="info" />
                  <span>
                    {collides ? t.collides : t.already(kindLabel(format))}
                  </span>
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {hasJobs && <JobsCard jobs={props.jobs} dispatch={props.dispatch} started={started} prefix="c" />}
    </div>
  );
}

