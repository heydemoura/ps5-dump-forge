// English: the source language. Every other file in this folder is typed as `Messages` (this
// object's shape), so tsc fails on a missing key. Grouped by the file that shows the text.
// Stays English in every language: format ids, file names and paths, product names, IEC units.

import type { ReactNode } from "react";

import type { Format, KrakenLevel, Lz4Facts } from "../api";
import type { Rating, Row } from "../Formats";
import type { ClientText } from "../http-client";
import { dotted, num, plural } from "../i18n";
import type { Failure } from "../launcher";
import type { Lz4Action, Scenario, TraceAct } from "../Lz4";
import type { Note } from "../target";

/** A flat image holds the game's files as they are: about as large as the game. */
const FLAT = "Equal to the game size";

const en = {
  // App.tsx
  app: {
    address: (url: string) => `Address: ${url}. Show how to connect, with a QR code`,
    screens: "Screens",
    convert: "Convert",
    active: (n: number) => `, ${num(n)} active`,
    inspect: "Inspect",
    library: "Library",
    about: "About",
    offline: "Offline, retrying…",
    stop: "Stop Dump Forge",
    stillRunning: (n: number): string => (n === 1 ? "A job is still running" : `${num(n)} jobs are still running`),
    job: (id: number) => `Job ${id}`,
    quitNote: (web: boolean, n: number) =>
      `${web ? "Stopping Dump Forge" : "Quitting"} stops ${n === 1 ? "it" : "them"} and deletes the unfinished output.`,
    keepRunning: "Keep running",
    stopAndQuit: (n: number): string => (n === 1 ? "Stop job and quit" : "Stop jobs and quit"),
    stoppingJobs: "Stopping jobs and cleaning up…",
    stoppingForge: "Stopping Dump Forge…",
    couldntStop: "Couldn't stop Dump Forge",
    close: "Close",
    tryAgain: "Try again",
    stopped: "Dump Forge has stopped",
    startAgain: "To continue, relaunch this app.",
    github: (name: string) => `${name} on GitHub`,
    queued: "queued",
    progress: (percent: number, left: string | null) => `${percent}% done${left ? `, ${left} left` : ""}`,
  },
  // Convert.tsx
  convert: {
    target: "Target",
    targetFormat: "Target format",
    alreadyFolder: "the source is already a folder",
    lz4Backport:
      "This game's assets are LZ4 packed and its LZ4 manifest lists the backport: unpack it in the LZ4 tab first, then remove the backport here.",
    lz4Trace:
      "This packed game carries the LZ4 trace runtime: unpack or pack it again in the LZ4 tab first.",
    unreadable: "Can't build: this source couldn't be read (see Source).",
    blocked: (first: string, more: number) =>
      `Can't build: ${first}${more > 0 ? ` (and ${num(more)} more, see Source)` : ""}.`,
    runtime: (install: boolean, version: string) =>
      `${install ? "Install" : "Replace"} the AMPR runtime (ampr_emu ${version})`,
    runtimeNone:
      "This game uses AMPR but has no fakelib/libSceAmpr.sprx: the output gets the bundled one.",
    runtimeOther:
      "fakelib/libSceAmpr.sprx isn't a runtime Forge ships (it may be newer or older): the output gets the bundled one instead.",
    runtimeRest:
      "The trace journal and logs are left out and a fresh ampr_emu.index is written. Only the output changes, never the source. Off: copied as it is.",
    runtimeWarn: (version: string) =>
      `ampr_emu ${version} is an upstream test build; known issue: some games crash when saving.`,
    removeBackport: "Remove backport",
    /** What "Remove backport" leaves out and keeps: the emulators by name, and any other homebrew libraries. */
    removeHint: (libs: number, emulators: string[], other: boolean) =>
      `Leaves out ${num(libs)} backport ${plural(libs, { one: "library", other: "libraries" })} from fakelib/` +
      (emulators.length === 0
        ? other
          ? "; other homebrew libraries stay."
          : "."
        : `; ${emulators.length === 1 ? "the emulator" : "the emulators"} (${emulators.join(", ")})${other ? " and other homebrew libraries" : ""} ${emulators.length === 1 && !other ? "stays" : "stay"}.`),
    cantRemove: (why: string) => `Can't remove the backport: ${why}`,
    compare: "Compare formats",
    build: "Build",
    likelyFail: (fmt: string): ReactNode => (
      <>
        Likely to fail as <b>{fmt}</b>: it refuses file names listed in Source.
      </>
    ),
    collides: "A job is already writing this file: Build again would fail. Pick another name.",
    already: (fmt: string): ReactNode => (
      <>
        Already building this game as <b>{fmt}</b>; Build again makes a second copy.
      </>
    ),
  },
  // Formats.tsx
  formats: {
    rating: { good: "Good", ok: "Trade-off", bad: "Drawback" } satisfies Record<Rating, string>,
    columns: ["Console speed", "Size on disk"],
    rows: {
      pkg: {
        tagline: "Best, if your firmware allows",
        cells: ["Native, full speed", "30–60% less, depending on the game"],
      },
      lz4: {
        tagline: "Experimental, for games that use AMPR",
        cells: ["30–40% faster loading, upstream's numbers", "About half the game size, upstream's numbers"],
      },
      ffpkg: { tagline: "Recommended for ShadowMountPlus", cells: ["Full image speed", FLAT] },
      exfat: { tagline: "Compatibility", cells: ["Full image speed", FLAT] },
      ffpfs: { tagline: "Experimental", cells: ["Full image speed", FLAT] },
      ffpfsc: {
        tagline: "Smallest, experimental",
        cells: ["150–250 MB/s, may stutter", "Depends on the compression level, usually 30–60% less"],
      },
      folder: { tagline: "Plain game files", cells: ["Full drive speed", FLAT] },
    } satisfies Record<Format, Row>,
    /** About's feature list: name, then a few words. */
    features: [
      ["Convert", "between a folder, ffpkg, exfat, ffpfs, ffpfsc and fpkg, both ways."],
      ["Inspect", "a game's cover, firmware, backport, DLC and file name problems before you build."],
      ["Verify", "every output after writing: a fast sample by default, every byte on request."],
      ["Delete", "a game from the disk, after you confirm."],
      ["LZ4", "trace an AMPR game, then pack its assets (experimental)."],
      ["AMPR runtime", "install or update ampr_emu in the converted copy."],
      ["PS5 payload", "the same app on the console, open from any device on your network."],
    ] as [string, string][],
    howToConnect: "How to connect",
    connectText: (url: ReactNode) => (
      <>Open {url} in a browser on any device on your local network, or scan this code.</>
    ),
    close: "Close",
    about: "About",
    aboutText: "This tool can convert a game from any format to any other, on any platform, including PS5.",
    connectAny: "How to connect on any device",
    useAddress: (url: ReactNode) => <>Use {url} or scan this code.</>,
    compare: "Compare formats",
    compareLabel: "Format comparison",
    format: "Format",
    upstream: (app: string) =>
      `Upstream's numbers: what the authors of ampr_emu and Lazy_AMPR report, not measured by ${app}; they vary by game. ampr_emu 0.4.2.1 is an upstream test build; known issue: some games crash when saving.`,
    bundled: "LZ4 packed folders run on ampr_emu 0.4.2.1 by drakmor (GPL-3.0), bundled unmodified. Source:",
    lazy: "The trace-then-pack workflow follows Lazy_AMPR by Nazky:",
    language: "Language",
    system: "System",
  },
  // Inspect.tsx
  inspect: {
    files: "Files",
    details: "Details",
    deleting: "Deleting the source…",
    delete: "Delete the source",
    deleted: "Deleted",
    contents: "Source contents",
    filter: "Filter by path",
    filterLabel: "Filter files by path",
    firstOf: (max: number, n: number) => `first ${num(max)} of ${num(n)}`,
    fileCount: (n: number) => `${num(n)} ${plural(n, { one: "file", other: "files" })}`,
    noMatch: (f: string) => `No files match “${f}”.`,
    emptyDirs: (n: number) => `Empty folders (${num(n)})`,
    noParam: "No sce_sys/param.json.",
    reader: "Reader",
    leftovers: "Leftover .part files",
    found: (n: number) => `${num(n)} found`,
    leftoversNote: (app: string) =>
      `Unfinished outputs, usually from interrupted jobs. Remove only the ones you recognize, and only when no job is running; ${app} never deletes them itself.`,
    checked: (n: number) => `Folders checked (${num(n)})`,
  },
  // JobList.tsx
  jobs: {
    jobs: "Jobs",
    pending: (n: number) => `${num(n)} running or queued`,
    allFinished: "all finished",
    /** Core's stage ids; one bar spans them all, the label says which pass is running. */
    stages: {
      scan: "Reading the source",
      preflight: "Checking",
      check: "Checking",
      plan: "Planning",
      compress: "Compressing",
      write: "Writing",
      measure: "Measuring packs",
      pack: "Packing",
      verify: "Verifying",
      finalize: "Finishing",
    },
    packingWriting: "Packing and writing",
    rate: { read: "read", compress: "compress", pack: "pack", write: "write" },
    showPath: "Show path",
    showFinder: "Show in Finder",
    showExplorer: "Show in Explorer",
    showFolder: "Show in folder",
    lz4: {
      pack: "LZ4 pack",
      unpack: "LZ4 unpack",
      trace: "LZ4 trace",
      unpatch: "LZ4 unpatch",
      runtime: "AMPR runtime",
    },
    job: (id: number) => `Job ${id}`,
    done: "Done",
    cancelled: "Cancelled",
    failed: "Failed",
    cancelling: "Cancelling…",
    queued: "Queued",
    dismiss: "Dismiss",
    stopJob: "Stop job?",
    cancel: "Cancel",
    stopHint: "Click Stop job? again within 4 seconds to stop it.",
    from: "from ",
    left: (d: string) => `${d} left`,
    result: (bytes: string, n: number) => `${bytes}, ${num(n)} ${plural(n, { one: "file", other: "files" })} →`,
    outputPath: "Output path",
    checks: "Checks",
    verifiedPlain: (n: number) => `Verified: ${num(n)} ${plural(n, { one: "check", other: "checks" })} passed`,
    verifiedFull: (n: number) => `Full verification passed: ${num(n)} ${plural(n, { one: "check", other: "checks" })}`,
    verifiedFast: (n: number) => `Fast verification passed: ${num(n)} ${plural(n, { one: "check", other: "checks" })}`,
    coverage: (checked: string, total: string, n: number) =>
      `Checked ${checked} of ${total} in ${num(n)} ${plural(n, { one: "sample", other: "samples" })}`,
    cantBuild: "Can't build this game:",
    cantBuildAs: (f: string) => (
      <>
        Can't build this game as <b>{f}</b>:
      </>
    ),
    log: (n: number) => `Log (${num(n)})`,
    logLabel: "Log",
  },
  // Library.tsx
  library: {
    pickTitle: "Choose a Library folder",
    scanningIn: (name: string) => `Scanning ${name}…`,
    scanning: "Scanning…",
    cantScanFolder: "Can’t scan this folder",
    chooseAnother: "Choose another folder…",
    pickPrompt: "Pick a folder with your library to scan",
    choose: "Choose folder…",
    cantScan: "Can’t scan the Library:",
    cantDelete: "Can’t delete:",
    deleted: (path: string) => `Deleted ${path}`,
    truncated: "Scan limit reached. This list may be incomplete.",
    limits: "Discovery stops at six folder levels and after about 15 seconds of scanning.",
    noRoots: "No folders are available to scan.",
    none: "No games found. Discovery checks up to six levels deep and skips system folders. Other sources can still be chosen in Inspect or Convert.",
    skipped: "Skipped locations and files",
    stays: "Results stay here until you press Refresh. New outputs appear after refreshing.",
    library: "Library",
    storageTip: "Free space on the console's internal storage (/data), as of the last scan",
    free: (free: string, total: string) => (
      <>
        Free <b>{free}</b> of {total}
      </>
    ),
    refresh: "Refresh",
    cards: "Card view",
    list: "List view",
    games: "Games",
    inspect: (n: string) => `Inspect ${n}`,
    convert: (n: string) => `Convert ${n}`,
    remove: (n: string) => `Delete ${n}`,
    lz4Tip: "LZ4 packed: ampr_emu asset packs",
    lz4Packed: " packed",
  },
  // Lz4.tsx
  lz4: {
    title: "LZ4 asset packs",
    help: "How LZ4 works",
    scenario: "LZ4 scenario",
    scenarios: { trace: "Trace", pack: "Pack/Unpack" },
    actions: { patch: "Patch", unpatch: "Unpatch", pack: "Pack", unpack: "Unpack" },
    scenarioInfo: (s: Scenario, packed: boolean): string => s === "trace"
      ? "Makes this game record which assets it reads while you play (ampr_commands.bin), for Pack to use. Unpatch puts the release runtime back."
      : packed
        ? "Unpack: writes the game's LZ4 packs back as plain files, into a folder or a plain image."
        : "Pack: packs the game's assets into LZ4 volumes that the bundled AMPR emulator (ampr_emu) reads while the game runs, into a folder or a plain image. A packed source is unpacked instead.",
    traceInfo: (a: TraceAct, image: boolean): string => a === "patch"
      ? image
        ? "Rebuilds this image with the trace runtime and room for the trace, then replaces it."
        : "Installs the trace runtime in this folder where it is: no copy is written."
      : image
        ? "Rebuilds this image with Forge's release runtime (0.4.2.1), without the recorded traces, then replaces it."
        : "Puts Forge's release runtime (0.4.2.1) back in this folder where it is: no copy is written.",
    noAmpr: "the game doesn't use AMPR",
    packedFirst: "the source is LZ4 packed: unpack it first",
    damaged: "its LZ4 packs are damaged",
    chooseFirst: "choose a source first",
    notRead: "the source isn't read yet",
    anyFormat: "Need ffpfsc or fpkg? Write a folder here, then convert it to any format on the Convert tab.",
    pickProfile: "LZ4 profile",
    profileFilter: "LZ4 profile (TOML)",
    pickTracesFolder: "LZ4 traces (a folder with ampr_commands.bin and ampr_emu.index)",
    pickTracesEither: "LZ4 traces: the zip, or a folder with both files",
    pickTracesZip: "LZ4 traces (zip)",
    unreadable: "Can't start: this source couldn't be read (see Source).",
    pending: (a: TraceAct): string => a === "patch"
      ? "Can't patch while a job is running or queued: patch once they have finished."
      : "Can't unpatch while a job is running or queued: unpatch once they have finished.",
    replacing: "A job is already rebuilding this image: wait for it to finish.",
    blocked: (a: Lz4Action, first: string, more: number) =>
      `Can't ${a}: ${first}${more > 0 ? ` (and ${num(more)} more, see Source)` : ""}.`,
    chooseGame: "Choose a game folder or image first.",
    nothing: "Nothing to do here: this game doesn't use AMPR (its eboot.bin doesn't import libSceAmpr), and it isn't LZ4 packed.",
    unavailable: (items: string[]) => `Not for this source: ${items.join("; ")}.`,
    readOnly: (kind: string): ReactNode => <>
      Can't patch or unpatch <b>{kind}</b>: it is read-only on the console, so the game can't write its trace there. Convert it to <b>ffpkg</b> (or <b>exfat</b>) on the Convert tab, then patch that.
    </>,
    action: "Action",
    traceAction: "Trace action",
    changes: (a: TraceAct, image: boolean) => a === "patch"
      ? `Changes this ${image ? "image" : "folder"}: the trace runtime replaces fakelib/libSceAmpr.sprx (no backup kept) and a fresh ampr_emu.index lists its files.`
      : `Changes this ${image ? "image" : "folder"}: Forge's release runtime (0.4.2.1) replaces fakelib/libSceAmpr.sprx (no backup kept), ampr_commands.bin and the trace logs are deleted, and a fresh ampr_emu.index lists its files.`,
    replay: (web: boolean) => `Play, then pick this source again: Pack/Unpack uses the traces it recorded${web ? ", and Trace offers them as a zip for a computer" : ""}. Each launch overwrites the previous session's trace.`,
    room: "Room for the trace",
    roomHint: "Free space added to the image for the game to write its trace into. Mount the image writable with ShadowMountPlus image_rw= or nothing is recorded: reserved space alone does not make it writable.",
    alreadyRelease: "This source already has the release runtime: only the index is written again.",
    spaceHint: "Needs free space about the image's size next to it; the image is replaced only after the copy verifies.",
    deletesTraces: (a: TraceAct, bytes: string, web: boolean) => `${a === "patch" ? "Patch" : "Unpatch"} deletes the traces this source recorded (ampr_commands.bin, ${bytes}): ${web ? "download them above or pack with them first." : "pack with them or copy them first."}`,
    useProfile: "Use a rules profile instead",
    profile: "Profile",
    choose: "Choose…",
    profileHint: "A TOML file of pack rules. It replaces the traces: choosing one clears the other.",
    target: "Target",
    packInto: "Pack into",
    direct: "Packs into the image directly: no temporary folder; the packed files are read twice.",
    targetFormat: "Target format",
    unpackFolder: "A new game folder with its LZ4 packs written back as plain files.",
    unpackHint: (n: number | null) =>
      `${n === null ? "Writes the packed files back as plain files" : `Writes the ${num(n)} packed ${plural(n, { one: "file back as a plain file", other: "files back as plain files" })}`}; keeps the AMPR runtime and its index.`,
    waitJobs: "Wait for the running jobs to finish",
    saveHint: "Save the files Pack would pack as an editable rules profile",
    saving: "Saving…",
    saveProfile: "Save as profile",
    saved: (name: string, packed: number, loose: number) => `Saved ${name}: ${num(packed)} ${plural(packed, { one: "file", other: "files" })} packed, ${num(loose)} loose. Edit it and load it with “Use a rules profile instead”.`,
    likelyFail: (fmt: string): ReactNode => <>
      Likely to fail as <b>{fmt}</b>: it refuses file names listed in Source.
    </>,
    collides: (a: Lz4Action, folder: boolean) => `A job is already writing this ${folder ? "folder" : "file"}: ${a === "pack" ? "Pack" : "Unpack"} again would fail. Pick another name.`,
    already: (a: Lz4Action, fmt: string): ReactNode => <>
      Already writing this game as <b>{fmt}</b>; {a === "pack" ? "Pack" : "Unpack"} again makes a second copy.
    </>,
    profileRules: "Packs what the profile's rules say, except the files the engine opens directly (container indexes, configs, media) — those stay loose.",
    chosenRules: "Packs the files the game read in the chosen traces, except those the engine opens directly (container indexes, configs, media) — those stay loose.",
    ownRules: "Packs the files the game read in its last traced session (this source's traces), except those the engine opens directly (container indexes, configs, media) — those stay loose.",
    guessRules: "No traces in this source: packs by a built-in guess, which is less reliable. Record traces first (Trace → Patch), or choose traces copied from the console, or a profile.",
    recorded: "Recorded traces",
    recordedHint: (bytes: string) => `ampr_commands.bin (${bytes}): Pack/Unpack loads these traces by itself.`,
    downloadHint: "Close the game and wait about a minute first: while the image is mounted, its file on disk can lag behind what the game wrote. Use a computer's browser opened at this console's Forge address, then pick the zip in LZ4 → Pack/Unpack → Traces on your computer. A download fails if the game or a sync changes the source meanwhile: close the game and download again.",
    download: (bytes: string, zip: string) => `Download traces (${bytes}) as ${zip}`,
    missingIndex: "No ampr_emu.index in this source: Pack needs it beside ampr_commands.bin, whose file ids it names.",
    truncatedJournal: "A journal cut off at the end still packs: Pack stops at its last whole record.",
    fakelibWarning: (recorded: boolean): string => recorded
      ? "Few or no traces? Turn off any fakelib updater while tracing: it overwrites fakelib/libSceAmpr.sprx, and then nothing is recorded. Turn it off, Patch again and replay."
      : "Turn off any fakelib updater while tracing: it overwrites fakelib/libSceAmpr.sprx, and then nothing is recorded.",
    emptyTitle: "Choose a game that uses AMPR",
    experimental: "Experimental: traces and LZ4 packs for ampr_emu. No guarantee the game runs afterwards; keep a copy of the original game.",
    chooseSource: "Choose source…",
    source: "Source",
    gameFolder: "Game folder…",
    image: "Image…",
    traces: "Traces",
    optionalTraces: "Traces (optional)",
    unlock: "Unlock to choose other traces",
    loaded: "Traces are already loaded from this source",
    lockedHint: (bytes: string) => `Its own ampr_commands.bin (${bytes}) and ampr_emu.index. Click the lock to choose other traces instead.`,
    clear: "Clear",
    zip: "Zip…",
    folder: "Folder…",
    tracesHint: "Pick the [game name]-[title ID]-amprtrace.zip from Trace → Download traces, or a folder with ampr_commands.bin and ampr_emu.index.",
    useOwn: "Use the source's traces",
    patchResult: (a: TraceAct, n: number) => `${a === "patch" ? "Patched: the trace runtime" : "Unpatched: Forge's release runtime (0.4.2.1)"} is in fakelib/libSceAmpr.sprx and ampr_emu.index lists ${num(n)} ${plural(n, { one: "file", other: "files" })}.`,
    removed: (files: string[]) =>
      `Removed the old trace ${plural(files.length, { one: "file", other: "files" })}: ${files.join(", ")}.`,
  },
  // Lz4Help.tsx
  lz4Help: {
    title: "How LZ4 works",
    close: "Close",
    warning:
      "Experimental, for AMPR games only. ampr_emu 0.4.2.1 is a test build: some games crash when saving. Keep a copy of the original game.",
    body: () => (
      <>
        <h3>1. Trace</h3>
        <ol>
          <li>
            Choose the game's <b>ffpkg</b> or <b>exfat</b>, then <b>Trace</b> → <b>Patch</b>.
          </li>
          <li>Turn off the fakelib updater: it overwrites the trace runtime.</li>
          <li>
            Mount it with <span className="path">image_rw=</span>, play one session, close the game.
          </li>
          <li>
            <b>Download traces</b> from the PS5 page, or copy ampr_commands.bin and ampr_emu.index.
          </li>
        </ol>

        <h3>2. Pack/Unpack</h3>
        <ol>
          <li>
            Choose the original game, <b>Pack/Unpack</b>, and the traces (or a profile).
          </li>
          <li>Write a packed folder or a plain image; a folder converts to any format in <b>Convert</b>.</li>
          <li>
            A packed source shows <b>Unpack</b> instead: the loose files come back.
          </li>
        </ol>
      </>
    ),
  },
  // Picker.tsx
  picker: {
    drives: "Drives",
    location: "Location",
    parent: "Parent folder",
    allDrives: "All drives",
    truncated: (n: number) =>
      plural(n, { one: "Only the first entry is shown.", other: `Only the first ${num(n)} entries are shown.` }),
    loading: "Loading…",
    noDrives: "No drives found.",
    noFolders: "No folders here.",
    noImages: "No folders or PS5 images here.",
    noFiles: (ext: string[]) => `No folders or ${dotted(ext, " or ")} files here.`,
    cancel: "Cancel",
    chooseFolder: "Choose this folder",
  },
  // common.tsx
  common: {
    folder: "Folder",
    pickFolder: "Game folder",
    pickImage: "Game image",
    pickImageFilter: "PS5 image or package",
    chooseFolder: "Choose folder…",
    chooseImage: "Choose image…",
    source: "Source",
    emptyTitle: "Choose a game folder or image",
    emptyText:
      "A PS5 game folder (sce_sys/param.json and eboot.bin at its root), or an image or package of one.",
    accepted: "Accepted sources",
    unknownTitle: "Unknown title",
    reading: "Reading the source…",
    unreadable: "Unreadable source",
    backport: "Backport",
    emulators: "Emulators",
    declares: (fw: string) => `declares ${fw}`,
    fwUnknown: "firmware unknown from its executables (no readable SDK)",
    emulatorList: (names: string) => `emulators: ${names}`,
    otherEmulator: "Other",
    sdk: (v: string) => `SDK ${v} (declared)`,
    titleId: "Title ID",
    version: "Version",
    firmware: "Firmware",
    fwDeclared: "declared",
    fwBackport: "backport",
    fwExecutables: "executables",
    size: "Size",
    files: (n: number) => `${num(n)} ${plural(n, { one: "file", other: "files" })}`,
    contentId: "Content ID",
    noAmpr: "eboot.bin does not import libSceAmpr",
    runtime: {
      forge_release: "Forge release",
      forge_trace: "Forge trace",
      other: "other",
      none: "none",
    } satisfies Record<Lz4Facts["runtime"], string>,
    packed: "Packed",
    damaged: "Damaged packs",
    traced: "Traced",
    plain: "Plain",
    packedDetail: (files: number, volumes: number, percent: number | null) =>
      `${num(files)} ${plural(files, { one: "file", other: "files" })} in ${num(volumes)} ${plural(volumes, { one: "volume", other: "volumes" })}` +
      (percent === null ? "" : `, ${num(percent)}% of size`),
    journal: (size: string) => `journal ${size}`,
    noJournal: "no journal yet",
    runtimeIs: (label: string) => `runtime ${label}`,
    backportLibs: (exclusive: boolean, n: number) =>
      `${exclusive ? "fakelib2/, mounted alone" : "fakelib/"}, ${num(n)} backport ${plural(n, { one: "library", other: "libraries" })}`,
    noFindings: "No preflight findings",
    findings: "Preflight findings",
    dlcTitle: (n: number) => `Embedded DLC (${num(n)})`,
    dlcLabel: "Embedded DLC",
    dlcAll: (note: string) => `All ${note}.`,
    dlcIn: (folder: string, size: string) => `in ${folder}/, ${size}`,
    dlcNoData: "unlocked by the DLC emulator (dlc_emu.ini): entitlement only, no data of its own",
    dlcStatus: (status: string | null) =>
      `unlocked by the DLC emulator (dlc_emu.ini), status ${status || "not set"}`,
    dlcMerged: "merged into the game's folders",
    backportFiles: "Backport files",
    emulatorsIn: "Emulators in fakelib",
    qr: (url: string) => `QR code: ${url}`,
  },
  // delete.tsx
  delete: {
    title: (folder: boolean): string => (folder ? "Delete this folder?" : "Delete this image?"),
    text: (folder: boolean) =>
      `${folder ? "The folder and everything in it" : "The image file"} will be deleted for good: no Trash, no undo. If deleting stops part way, some of it may already be gone.`,
    no: "No",
    yes: "Yes, delete",
  },
  // main-http.tsx
  launch: {
    failure: {
      loader:
        "Can't reach the payload loader on port 9021. Run your autoloader (jailbreak) first, then open Dump Forge again.",
      missing:
        "No saved copy of Dump Forge was found (in /data/dumpforge/ or on a USB drive). Load it once from a PC; it saves a copy for this icon.",
      timeout:
        "Dump Forge was started but hasn't answered after 30 seconds. It may still be starting (a console waking from rest mode is slow).",
    } satisfies Record<Failure, string>,
    loadFailed: (e: string) => `Couldn't load the page: ${e}`,
    noAnswer: "Dump Forge didn't answer",
    cantStart: "Can't start Dump Forge",
    retry: "Retry",
    starting: "Starting Dump Forge…",
    /** http-client.ts's own messages (it imports nothing at run time). */
    client: {
      unreachable:
        "Can't reach Dump Forge. Check that the payload is still running and this device is on the same network.",
      noPlatform: "Can't determine whether Dump Forge is running on a PS5. Refresh to try again.",
      quitUnreachable: "Can't reach Dump Forge to stop it.",
      stillAnswering: "Dump Forge is still answering after 2 minutes; check the PS5.",
      gone: "no longer reported by Dump Forge (dropped from its job history before its result was seen)",
    } satisfies Record<ClientText, string>,
  },
  // target.tsx
  target: {
    /** One line under a target picker: which one to pick, and when. */
    format: {
      folder: { text: "Unpack an image or package back into a plain game folder." },
      exfat: {
        text: "For games that misbehave as ffpkg and only run like external-drive content. Also opens on a Mac or PC.",
      },
      ffpkg: { tone: "good", text: "Recommended. The PS5's own file system (UFS2). Writable mounts possible." },
      ffpfs: {
        tone: "warn",
        text: "Experimental. The PS5's PFS file system, uncompressed. File names must be plain ASCII.",
      },
      ffpfsc: {
        tone: "warn",
        text: "Experimental. Smallest: a compressed container around one image, always mounted read-only.",
      },
      pkg: {
        text: "Installs like a store game and runs at native speed. Needs kstuff, fpkg-enable and ppr-patch.",
      },
      lz4: {
        tone: "warn",
        text: "Experimental. A game folder with its assets packed into LZ4 volumes, which the bundled AMPR emulator (ampr_emu) unpacks while the game runs. Only for games that use AMPR.",
      },
    } satisfies Record<Format, Note>,
    /** The inner `.ffpkg`'s line: the format's own, less what a read-only `.ffpfsc` doesn't give. */
    innerFfpkg: { tone: "good", text: "Recommended. The PS5's own file system (UFS2)." } as Note,
    level0: { text: "No compression: every block stored as it is. The file is as large as the image." } as Note,
    levelDefault: {
      tone: "good",
      text: "Recommended (zlib's default). 1 builds about 3× faster with a file about 3% larger; 9 is barely smaller.",
    } as Note,
    levelLow: {
      text: "Builds faster than 6 (level 1 about 3×); the file comes out larger (level 1 about 3%).",
    } as Note,
    levelHigh: {
      text: "Barely smaller than 6 (level 9 by 0.04%), but compressing takes longer (level 9 about 25%), with every core busy throughout.",
    } as Note,
    kraken: {
      fast: { label: "Fast", note: { tone: "good", text: "Recommended. The quickest build." } },
      balanced: {
        label: "Balanced",
        note: {
          text: "About 2.6% smaller than Fast, but compressing takes about 6× as long, with every core busy the whole time.",
        },
      },
      smallest: {
        label: "Smallest",
        note: {
          text: "About 2.7% smaller than Fast, but compressing takes about 9× as long, with every core busy the whole time.",
        },
      },
    } satisfies Record<KrakenLevel, { label: string; note: Note }>,
    pkgFirmware: "Works only on firmware 11.60 or lower.",
    imageInside: "Image inside",
    imageInsideLabel: "Image inside the ffpfsc",
    compressionLevel: "Compression level",
    compression: "Compression",
    fullVerify: "Full verification",
    fullVerifyHint: "Re-reads every byte to check the output. Takes longer.",
    separator: "A name can't contain a folder separator; use Change… for the folder.",
    tooLong: (bytes: number, max: number, folder: boolean) =>
      `Too long: ${bytes} bytes${folder ? "" : " before the extension"}, at most ${max} (UTF-8).`,
    pkgExt: (ext: string) => `Ends in .${ext}, but fpkg is saved as .pkg: the extension picks the driver.`,
    otherExt: (ext: string, target: string) =>
      `Ends in .${ext}, but the target is ${target}: the extension picks the driver.`,
    extractInto: "Extract into this folder",
    saveInto: "Save into this folder",
    output: "Output",
    change: "Change…",
    naming: "Naming…",
    chooseSourceFirst: "Choose a source first",
    fileName: "File name",
    savedAs: (name: string, dir: string) => `saved as ${name} in ${dir}`,
    inDir: (dir: string) => `in ${dir}`,
    generate: "Generate name based on content",
    generatePattern: "[game name]-[title ID]",
  },
  // transport-tauri.tsx: the native save dialog
  tauri: { saveProfile: "Save as profile", profileFilter: "LZ4 profile (TOML)" },
  // api.ts: prettyDuration, whole per language (CJK writes 5分30秒, no spaces)
  duration: { s: (s: number) => `${s} s`, ms: (m: number, s: number) => `${m} min ${s} s`, hm: (h: number, m: number) => `${h} h ${m} min` },
};

export type Messages = typeof en;
export default en;
