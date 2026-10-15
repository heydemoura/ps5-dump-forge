# AGENTS.md

ps5-dump-forge: converts a PS5 game between a folder and every image format ShadowMountPlus 1.7
mounts (`.exfat`, `.ffpkg` UFS2, `.ffpfs` PFS, `.ffpfsc` compressed PFS container; read and write), plus
debug FPKG `.pkg` (create and extract). Rust core, Tauri 2 GUI (`PS5 Dump Forge.app`/`.exe`/`.AppDir`), a
CLI (`ps5-dump-forge`), and a PS5 ELF payload (the CLI's `serve`: the same UI as a web page on port 8095).
Releases: macOS (one universal zip), Windows x86-64 and arm64, Linux x86-64 and arm64, the PS5 `.elf`.
`ps5/README.md` holds the payload's details (harness, HTTP routes, tile/self copy/launch on open, U1–U10
write safety); `docs/LZ4.md` the LZ4 user guide.

## Layout
- `crates/ps5-dump-forge-core`: everything a job does. Own folder scanner (no symlink follow,
  exact names), preflight (names, special files, space, FAT32, depth, name limits), jobs (a worker thread
  per job, one heavy job at a time in FIFO order, cancel flag, `catch_unwind`), `.part` + atomic no-replace
  rename (`finalize.rs`; macOS exFAT has none: check, then rename; FreeBSD: hard link where the folder has
  them, U3), BLAKE3 verification (`verify.rs`: 8 MiB slice hashes on a pool of up to 8 threads, fast sample
  or full), `inspect.rs` (cover, firmware, backport firmware from executables, embedded DLC; default and
  generated output names), `prefetch.rs` (read-ahead thread), `delete.rs` (Inspect's and Library's delete),
  `library_roots.rs` (PS5 filesystem classifier, the chosen-folder refusal list) and `library.rs`
  (`scan_library`, `library_cover`). FreeBSD/PS5 only: `dest.rs` (destination probe, U1), `durable.rs`
  (`sync_retry`, `SyncEvery`, drive-removal check; U4/U5/U7). `lib.rs` is the public API the CLI, the app
  and the server build against.
- `crates/ps5-dump-forge-exfat`: forward-only exFAT writer (512 B sectors, 64 KiB clusters), ported
  from MkPFS. `crates/ps5-dump-forge-ufs2`: write-once UFS2 writer for the one SMP geometry
  (`newfs -O 2 -b 65536 -f 65536 -m 0 -S 4096`). Both: `plan` (validates names, sizes the image)
  then `write` (strict offset order into a caller-owned file).
- `crates/ps5-dump-forge-pfs`: PFS writer for `.ffpfs` (MkPFS's unsigned PS5 layout, same `plan`/`write`
  shape), the streaming `.ffpfsc` container writer (`wrap`: the inner image's writer → `Stream` → zlib
  workers → `.part`), and the PFS/PFSC readers (`PfsSource`, `open_ffpfsc`).
- `crates/ps5-dump-forge-fpkg`: streaming `.pkg` reader (`FpkgSource`), CNT entries merged with the
  inner filesystem.
- `crates/ps5-dump-forge-lz4`: ampr_emu asset packs: AMPRPAK4 manifest + AMPRDAT3 volume writer and
  reader (unpack view as a `SourceTree`), AMPRIDX3 and AMPRCMD1 (journal) readers, pack rules (`rules.rs`),
  the embedded runtimes (`runtime.rs`). Glue in `core/src/lz4.rs` (open/unpack, trace, index, runtime swap);
  `core/src/lz4_patch.rs` is the in-place folder patch and unpatch; `core/src/lz4_profile.rs` is Save as profile.
  `tree.rs` is `PackedTree`, the packs served as a `SourceTree` from a `writer::measure` pass.
  `vendor/ampr_emu/`: the two upstream 0.4.2.1 `.sprx` runtimes + the source archive (see its README).
- `crates/ps5-dump-forge-archive`: `.zip`/`.7z`/`.rar` sources (`detect`, `list`, `read_files`, `Reader`,
  `ArchiveError`, the two password strings). `zip.rs` own reader (ZIP64, STORED + Deflate via `flate2`), `sevenz.rs`
  over `sevenz-rust2` (decode only), `rar.rs` our FFI wrapper over `unrar_sys` (bundles UnRAR's C++; every target,
  the PS5 payload included), `parts.rs` multi-part naming, `stream.rs` the `Reader`. Glue: `core/src/archive.rs` (`ArchiveTree`), `inspect.rs`,
  `library::archive_game_root`. Licence: `vendor/LICENSE-UnRAR.txt`, `vendor/LICENSE-UnRAR-exception.md` (copied into every release).
- `crates/ps5-dump-forge-cli`: binary `ps5-dump-forge` (`inspect`, `convert`, `serve`), JSON-lines events.
- `crates/ps5-dump-forge-ps5`: the payload's global allocator (`Pool`, installed by the CLI only for
  the PS5): freed blocks of 64 B..4 MiB kept in power-of-two classes, since the PS5 libc serializes
  every malloc across threads (a `.pkg`'s Kraken pool: 12.7 → 49.3 MB/s at 4 threads).
- `crates/ps5-dump-forge-server`: `serve`, std-only HTTP/1.1 (`http.rs`), routes mirroring the Tauri commands
  (`api.rs`), job table for polling (`table.rs`), roots (`paths.rs`), PS5 tile (`tile.rs`), self copy
  (`self_copy.rs`), `debug.rs` (PS5 only, with `FORGE_DEBUG_API`). `build.rs` embeds `app/dist-http` and the
  self copy.
- `ps5/`: the payload's Docker harness: `Dockerfile`, `build.sh`, `linker.sh`, `entry.c` (launch modes,
  logs, `ps5_notify`), `compat.c` (statfs symvers; `cpuset_getaffinity` answered per thread, so std sees the 5 CPUs
  a payload may use, not 16), `launcher.c` (tile registration), `icon0.png`,
  `test-entry.sh`; `shim/` + `x86_64-ps5-freebsd.json` + `prepare-rust-std.py` are ps5-ai-cli's, byte-identical.
- `app/`: React/TS/Vite UI; `app/src-tauri` is the `ps5-dump-forge-gui` crate (binary `Forge`,
  bundled as "PS5 Dump Forge" via `mainBinaryName`; Linux's `tauri.linux.conf.json` names it
  `ps5-dump-forge-gui` so the AppImage step can't overwrite the CLI's `ps5-dump-forge`).
  `npm run build:http` (Vite mode `http`) builds the web UI into `app/dist-http`: `transport-http.tsx`
  replaces `transport-tauri.tsx`, `Picker.tsx` the native dialogs, `main-http.tsx` runs `launcher.ts`
  (start the payload via elfldr) and `appcache.ts` first.
  `app/scripts/*.mjs`: plain-node checks (`check-paths`, `check-poller`, `check-launcher`, `check-update`, `smoke`).
- `vendor/ps5upload-{fpkg,pkg}`: ps5upload v7.0.22 crates (readers, FPKG builder, verify) plus a
  local patch series in `vendor/patches/`; see `vendor/README.md`. Edition 2021 on purpose.
  `vendor/lzma-rust2`: crates.io 0.22.0 + patch 0021 (bounded multithreaded LZMA2 decode, which
  `sevenz.rs` sizes per block by dictionary and largest run), via `[patch.crates-io]`, excluded
  from the workspace.
- `scripts/`: checks and releases (see Commands); `check-versions.sh` also matches the tag on a tag build.
  `fuzz/`: cargo-fuzz targets, its own workspace.
- `DESIGN.md`: the UI design system (tokens, components, colour/contrast rules, the cover glow);
  `app/src/styles.css` holds the values. Read it before changing the UI.
  `app/src/locales/`: the UI text, one file per language (see Key decisions).

## Key decisions
- Every reader/writer meets at `ps5upload_fpkg::source::SourceTree` (sizes up front, `read_range`,
  `empty_dirs`, `Send`). Any source converts to any target with no staging, archives included.
- Archive sources (`.zip`/`.7z`/`.rar`, one game root ≤ 4 levels deep, found by the Library's recognition from the
  listing) are read in place, never unpacked to disk: `core/src/archive.rs` serves the game folder as an
  `ArchiveTree` over the archive crate's `Reader`, which decodes front to back on its own thread (a session; bounded
  queue) and serves the entry asked for, skipping those before it; an entry the session went past (or a ZIP/7z skip
  that never recorded it) starts a new session from the archive's start: cheap when non-solid (header skips),
  a re-decode of everything before it when solid (by user decision: no temporary files, even for solid
  archives). Verification hashes as written, so nothing re-reads the archive. The source stamp covers every
  part. Every part of a multi-part source is guarded from delete while its job is unfinished; trace/in-place/patch refuse an archive; the Library lists none. Inspect reads only the entries it needs (no
  extraction). Passwords for 7z and rar only (encrypted zip refused), `ArchivePassword` redacted in `Debug`, never
  serialized or logged; with none given, `archive::password` tries `KNOWN_PASSWORDS` (by user decision: six
  release-site passwords, in order; one fits when the game folder's `param.json` reads, and when that
  file is in the clear, the game's smallest encrypted file too; `Entry::encrypted`) for Inspect, naming and
  jobs alike, and only when none fits is the error "needs a password" (the UI's prompt); CLI `--password-stdin` / `FORGE_ARCHIVE_PASSWORD`. Multi-part: `.partN.rar`, `.rar`+`.rNN`,
  `.7z.NNN`/`.zip.NNN`, split `.z01`…`.zip`; first part only, missing parts named. 7z Deflate is refused: its
  `deflate` feature would switch the workspace's `flate2` to zlib-rs, replacing `.ffpfsc`'s miniz_oxide.
  Memory (by user decision): a job stays within 512 MiB except for the archive's own dictionary,
  which the decoder allocates whole: RAR is accepted up to 4 GiB and 7z up to 1 GiB, so an archive
  packed with a dictionary over ~256 MiB goes past the cap. 7z LZMA2 decodes on several threads
  only in a job's session (`Sink::streams`; small reads stay on one) and for a block that is a lone
  LZMA2 coder, sized per block (dictionary + 6 × its largest run within 256 MiB; `sevenz::decode_threads`); RAR5 decodes on UnRAR's own threads (at most 8).
- LZ4 packs are an asset-pack transform of a game folder (ampr_emu), not an SMP image format: `--to lz4`
  writes a folder (no extension) with `ampr_assets.index`, `.crc`, `ampr_assets-NNN.pak` volumes, loose
  leftovers and the runtime; converting that folder to an image is an ordinary second convert (packs are
  carried). Pack can also target an image directly (`Lz4Mode::Pack`, `lz4: "pack"`, CLI `--lz4-pack`;
  `format` folder/exfat/ffpkg/ffpfs/ffpfsc, `.pkg` refused "not supported yet"; `Format::Lz4` is the alias of
  pack into a folder): **two passes, no staging folder**. `writer::measure` runs `pack`'s compression
  without writing and keeps only the metadata (`Measured`: manifest, CRC sidecar, profile, volume sizes,
  build ID; 16 B per chunk; the job peaks near 36 B per chunk while verify parses the manifest).
  `tree::PackedTree` lists the loose files plus the pack files at those sizes; reading a volume re-reads
  each chunk's source block, recompresses it with the one `writer::encode`, and fails unless stored length,
  codec, CRC and the LZ4 chunk's decoded CRC match the measurement; one cached chunk, `threads * 4` blocks
  in flight per volume. `pack` and `measure` share one `Sink` (placement, thresholds, rollover) and one
  `metadata`; folder output is pinned byte for byte by a hash test. The image job: measure (stage
  `measure`), plan → write from `HashingTree(PackedTree(HashingTree(logical)))`, verify as written, then
  `reader::unpack` of the image (every runtime check) and the logical files against the source, same
  fast/full policy. Pack and trace need a title whose `eboot.bin` imports `libSceAmpr`. Compression is
  `lz4_flex`.
  UI: every LZ4 action lives in the LZ4 tab (`app/src/Lz4.tsx`; **How LZ4 works** help in `Lz4Help.tsx`).
  Two scenarios: **Pack/Unpack** (first, and the default whenever usable; traces as a zip or folder, locked
  to the source's own when it is traced, or a profile; Unpack when the source is packed), then **Trace** (a
  folder, `.exfat` or `.ffpkg`: Patch / Unpatch; a folder through `lz4_patch`/`lz4_unpatch`, an image
  through a conversion with `lz4: "trace"|"unpatch"`, `format` = the source's, `lz4_in_place: true`;
  Download traces in the web build once a journal is there). An AMPR game without its own ampr_emu (runtime `none`) gets
  no LZ4 action in the tab, Pack included (by user decision; the right card says why, the source card stays). Target pickers (a UI limit; core and CLI keep
  `.ffpfsc`): Pack folder/`.exfat` (default)/`.ffpkg`/`.ffpfs`, Unpack folder/`.exfat` (default)/`.ffpkg`/`.ffpfs`.
  Convert sends `lz4: null` except for its **Update AMPR** switch (in the Full verification box, with a one-line
  reason; on for each new source), which sends `lz4: "unpatch"`, never `lz4_in_place`. It shows only for an AMPR
  title, not packed, no damaged manifest, whose own runtime (`other`) names an ampr_emu version
  (`Lz4Facts.runtime_version`, from `runtime::version_of`: the "<ver> (c) Drakmor" string) older than the bundled
  one: not without a runtime, nor for one whose version can't be read. A runtime at least the bundled version
  (`not_older`; `Lz4Facts.runtime_current`) is left alone: no switch, and Pack keeps it when it also holds the pack format's
  magics (`runtime::reads_packs`; upstream's no-pack build is replaced; Patch/Unpatch still install theirs). Job rows: an LZ4 tab job has a yellow edge and an `LZ4 pack|unpack|trace|unpatch` tag;
  Convert's runtime job is tagged `AMPR runtime`.
- The recommended trace path is a traced `.ffpkg` mounted `image_rw=`, then **Download traces** (http build
  only; the desktop app points at Pack): `GET /api/lz4_traces?source=` streams one STORED zip
  (`[GAME_TITLE]-[TITLE_ID]-amprtrace.zip`, the generated output stem + `-amprtrace.zip`) of
  `ampr_commands.bin` + `ampr_emu.index` out of a folder or any image via core's `lz4_traces`
  (`Lz4Traces`; `write_zip`/`zip_len`) in 1 MiB chunks, never whole in memory. `core/src/zip.rs` is the
  one zip layout, writer and reader (flag bit 3 + data descriptors, ZIP64 only past 0xFFFFFFFF). Every
  read re-checks a `SourceStamp` (the image file, or a folder's trace files: length, mtime, identity) and
  fails on any change, so the body ends short of `Content-Length`. `/mnt/shadowmnt` is a PS5 root so the
  mounted image's folder can be picked too. Patching a folder stays offered, though a folder patched in
  place failed to launch on the console (CE-107750-0, cause unknown) where a Forge `.ffpkg` did.
  Both upstream runtimes (release, trace) are embedded with `include_bytes!`, pinned by SHA-256; the trace
  runtime is swapped for the release one on every pack or plain conversion of a traced dump. Unpatch
  (`Lz4Mode::Unpatch`, `--lz4-unpatch`) does that explicitly: the release runtime over any runtime
  (Forge's trace build or another; no backup exists), journal and logs left out, a fresh index; refused
  for a packed source ("unpack first") and with `--to lz4` (redundant).
- LZ4 rule sources, first match: `--lz4-profile x.toml`, copied traces (`--lz4-traces`), the dump's own
  journal of the last trace session (`ampr_commands.bin`, mapped to paths through the source's
  `ampr_emu.index`), else the built-in guess. `--lz4-unpack` (automatic when the target is lz4) restores the
  logical assets but keeps the runtime and `ampr_emu.index`. A trace (`--lz4-trace`) writes the journal on
  the title's `/app0`, so the output must be writable there: a folder, or an `image_rw` exfat/ffpkg with
  `--lz4-trace-space` MiB (default 256, 64..1024 step 64) of free room; `.ffpfs`/`.ffpfsc`/`.pkg` are refused.
  `--lz4-traces <zip|folder|ampr_commands.bin>` (the downloaded zip: STORED entries only, each CRC-checked,
  the journal streamed from its byte range; a folder holding both files; or the journal with its index
  beside it; `--to lz4` or `--lz4-pack` only, exclusive with a profile). Membership check: every path the
  index lists must be in the dump (else refused: another dump or version), leaving out on both sides the
  journal, index, logs, `fakelib/libSceAmpr.sprx` and patch temp names; files only in the dump are allowed,
  unobserved and loose, logged in one line (first 10 + a count). Observed ids resolve through the traced
  index's own record order. Traces only narrow the built-in guess: an observed file is packed only if the
  fallback rules would pack it too.
  Packed files exist for the game only after it starts AMPR, so anything the engine opens, stats or lists
  before that (Unreal `.pak`/`.utoc`, `.ini`, `.uproject`) must stay loose. The keep-loose list
  (`rules::keep_loose`: `FALLBACK_SUFFIXES` + the protected directory families; not the fallback's
  root-files rule) applies to every rule source, a profile included (one log line counts what the profile
  wanted packed, first 10). Then auto-loose (upstream `ampr_pack.py`, `rules::AutoLoose`, `[pack]
  auto_loose_*` honored within upstream's bounds): a compress-spec file (not store; hot only with
  `auto_loose_hot_files`) of ≥ 64 MiB is sampled during preflight (32 blocks / ≤ 16 MiB at fixed, evenly
  spread block indices, `writer::sample` = the writer's `encode`) and kept loose when it saves < 5% or
  ≥ 90% of the blocks stay RAW; one log line `auto-loose: N large files kept loose (incompressible samples): …`.
- Save as profile (`lz4_plan_profile(&ConvertRequest)` → `Lz4PlanProfile {file_name, toml, packed, loose,
  log}`, `core/src/lz4_profile.rs`; `convert::lz4_plan` runs a Pack job's front half with every rule,
  writes nothing, LZ4 findings are the error). The TOML has `auto_loose_large_files = false` (already
  applied) and one `[[rule]]` per distinct `PackSpec` with exact, fnmatch-escaped paths; loaded back it
  selects the same specs (round-trip test). Name: the generated stem + `-lz4profile.toml`. CLI
  `lz4-profile` (`-o`; default next to the source, never
  overwrites); server `POST /api/lz4_plan_profile` `{request}` (Blob download in the page); Tauri
  `lz4_save_plan_profile {request, dest}` (`dialog:allow-save`). UI: **Save as profile** beside Pack.
- Never touch the source: junk (`.DS_Store`, `._*`, `.fseventsd`, ...) is filtered, not deleted.
  Three exceptions, by user decision, all explicit requests:
  1. The LZ4 folder patch and unpatch (`lz4_patch`/`lz4_unpatch`, CLI `lz4-patch`/`lz4-unpatch`, server
     `POST /api/lz4_patch`/`POST /api/lz4_unpatch` `{source}`, Tauri `lz4_patch`/`lz4_unpatch` `{path}`)
     change a plain game folder of an AMPR title: the trace (unpatch: release) runtime replaces any
     `fakelib/libSceAmpr.sprx` (no backup), the journal and logs are deleted (root synced) and a fresh
     `ampr_emu.index` is written, each file via an exclusive per-attempt temporary name
     (`.<name>.forge-<pid>-<n>.tmp`, never indexed, ignored by the traces' membership check), sync and
     rename, then the folder synced; 0777 on the PS5. Everything is checked first: images, packed
     folders, non-AMPR titles, a non-file at any target path and (PS5) the destination probe refuse with
     nothing changed; so does a job queued or running.
  2. An image patched or unpatched in place (`ConvertRequest.lz4_in_place`, CLI `convert <img>
     --lz4-trace|--lz4-unpatch --lz4-in-place`): rebuild + replace. Only an `.exfat`/`.ffpkg` source,
     `format` its own, `lz4` `trace` or `unpatch`, not packed (else preflight findings; `.ffpfs`/`.ffpfsc`/
     `.pkg` are read-only on the console). `output` is ignored: the job writes `<source>.<job>-<pid>.part`
     beside the source (the destination check counts the whole new image), verifies it as usual, re-checks
     the source's `SourceStamp`, closes the source and renames the part over it (`Part::replace`, one
     atomic rename, folder synced). Any failure leaves the source byte-identical and the `.part` deleted.
     The server's stale-part filter takes an in-place job's `.part` from its source.
  3. Deleting the inspected source or a Library entry (the trash button of Inspect or of a Library
     card/row, one **No** / **Yes, delete** dialog and one route; core `Jobs::delete_path(path, protected)`
     → `DeleteError` `Refused`/`Missing`/`Busy`/`Failed`, `core/src/delete.rs`; server
     `POST /api/delete_path` `{path}` → `null`, 400/404/409/500, 409 also while stopping; Tauri
     `delete_path` `{path}`). A file (`remove_file`) or folder (`remove_dir_all`: links inside removed, not
     followed), then its folder synced; no Trash, no undo, and a folder that fails part way may be partly
     gone (the error says so). Refused: an empty path, a link itself, a special file, a volume root or
     mount point, a folder with another volume mounted inside (unix, by `st_dev`; a same-filesystem Linux
     bind mount is not caught), each `protected` path and folders holding it (server: browse roots,
     configured and current; app: the home folder), and anything at, in or above an unfinished job's
     source, output, `.part`s, profile or traces (a lone journal's index too), compared by identity after
     canonicalize, links on the typed path included. Check and removal run with the job table locked, so
     no job is admitted between them. Leftover `.part`s are not cleaned up here.
- Library (the tab after LZ4, `app/src/Library.tsx`): the game dumps on this computer or console, scanned
  on demand; no database, no index, no persisted state. Core `scan_library(roots)` (PS5 server roots only;
  elsewhere it errors) / `scan_library_folder(root)` (a chosen folder) / `library_cover(path)`; Tauri
  `library_scan {root}` (`root` required) / `library_cover`; server `POST /api/library_scan` `{}` (`"root"`
  string: scan that folder on any platform, a non-string is 400; without it the PS5 scans its roots and a
  computer answers 400 "choose a folder to scan"; on the PS5 the reply adds `storage` `{free, total}`
  (bytes, `statfs` of `/data`; absent when `statfs` fails), shown in the header as "Free 312 GB of 825 GB"
  (decimal GB, whole numbers, one decimal under 10 GB)) and `POST /api/library_cover` `{path}` (409 while
  stopping, 429 when the shared cap of 2 concurrent source reads (inspections, naming, covers, scans) stays full for
  30 s: a read waits for a slot first, at most 4 waiting; 409 once stopping).
  A chosen folder may be on any filesystem, a network share included; mounts nested inside it are walked,
  a chosen root that is a link is resolved first, links inside the walk are never followed,
  `/mnt/shadowmnt` is refused.
  - **Roots**: on a computer the user chooses one folder (no automatic discovery). On the PS5 the server's
    `Roots::library()`: the current browse roots minus `/mnt/shadowmnt` (no duplicate of a mounted image),
    classified by FreeBSD `statfs` (`MNT_LOCAL` and ufs, msdosfs, exfat, exfatfs, bfs, nullfs, cd9660,
    udf, zfs).
  - **Refused folders** (`scan_library_folder` errors, so the app and the server agree; one list,
    `library_roots::refusal`, checked on the canonical path, ASCII case-insensitive on macOS and Windows):
    the filesystem root (Windows: the system drive root), `~/Library` / `~/AppData` and everything inside,
    and each OS's system folders with everything inside (macOS `/System`, `/usr`, `/private` except
    `/private/tmp`, ...; Linux `/proc`, `/usr`, `/run` except `/run/media/…`, ...; Windows, Program Files,
    ... on the system drive). A path at or inside the canonical home is allowed first (a `/var/home/me` or
    `/root` home works). Everything else is allowed (home and its children, `/Volumes`, `/media`, `/mnt`,
    volume and drive roots). `library_cover` refuses only links, devices and `/mnt/shadowmnt`.
    Walk exclusions: 12 skip names, the home's app-data folder, `.part`, non-UTF-8 names.
  - **Limits** (`library.rs`): depth 6 (root 0), 20,000 directories and 200,000 entries per root, 10,000
    entries per directory, 256 image opens, 2,000 games, 15 s budget, 20 warnings; hitting one sets
    `truncated` (the UI says the list may be incomplete).
  - **Recognition**: a folder with a regular `eboot.bin` and a plain `sce_sys` holding a `param.json`
    (1 B..4 MiB) that parses to a title ID is a game and is not entered (a rejected folder is searched on);
    images by extension (`.exfat .ffpkg .ffpfs .ffpfsc .pkg`, any case) are opened with `open_source` and
    need the same files. Entry = path, kind, title ID, localized title (fallback: title ID, then file
    name), version, `has_cover` (a regular `icon0.png` of 1 B..512 KiB by metadata; discovery reads no
    icon), `lz4_packed` (`reader::detect`'s rule: a root `ampr_assets.index` starting with `AMPRPAK4`; the
    UI's LZ4 badge). Sorted by title, ID, version, path. `library_cover` reads `sce_sys/icon0.png`
    (≤ 512 KiB) lazily, one at a time in list order, only for an entry the page lists.
  - **Semantics**: `runtimePlatform()` (`GET /api/session` `platform`) decides. On a computer (`host`)
    nothing scans until the user chooses a folder (**Choose folder**; **Refresh** rescans it). A refused
    or failed newly chosen folder is an error screen with core's message and drops the previous folder and
    list; a failed Refresh keeps the list. On the PS5 the first open scans the server's roots, **Refresh**
    rescans; no picker. Everything lives in memory until the app closes. Cards and rows show the title ID.
  - **Actions**: Inspect and Convert hand the entry to `App` as a `SourceSelection {id, path, kind}` (one per
    tab; the tab switches and loads it); Delete uses the same `confirmDelete` (`app/src/delete.tsx`),
    `delete_path` and refusals as Inspect, then `notifyDeleted`, which Inspect, Convert, LZ4 and the Library
    all hear.
- Names are never renamed: bad names (non-NFC, exFAT/PFS case collisions, forbidden chars, non-ASCII
  in PFS) fail preflight with every offender listed.
- `.pkg` is built with `BuildRequest::production` only (plaintext `PPRPLAIN-NOAUTH!`, Kraken);
  installing needs kstuff + fpkg-enable + ppr-patch. Debug keys are embedded.
  The builder writes a fresh `ampr_emu.index` from the packaged files (a libSceAmpr title or a source
  with one; a stale index crashes the game; a case clash refuses), except for an LZ4-packed source, whose
  own index is kept byte for byte (the runtime checks each record against the pack manifest by file id).
- The UI names formats without the dot (`ffpkg`, `exfat`, `ffpfs`, `ffpfsc`, `fpkg`; `KIND_LABEL` in
  `common.tsx`), and in running text in bold (`Prose`); paths and file names keep the extension. The debug
  FPKG is labelled `fpkg`; its files, the `Format`/`Kind` id and the CLI flag stay `pkg`. Format copy and
  the About tab's formats table (`app/src/Formats.tsx`) follow ShadowMountPlus 1.7's README and release notes.
- UI languages: English (the fallback), Russian, Simplified Chinese (`zh`), German, Spanish, French,
  Japanese, Brazilian Portuguese (`pt`), Italian, Korean and Arabic; UI text only (`app/src/i18n.ts`). Backend text
  (errors, findings, job logs, checks, `describe`), the CLI, `entry.c`'s notices, format ids, file names, product
  names and IEC units stay English; code that matches backend English keeps doing so. Messages live in
  `app/src/locales/<lang>.tsx`, one file per language, grouped by the file that shows them
  (`lz4`, `convert`, ...): `en.tsx` is the source and defines `Messages`, every other one is typed
  `Messages` (tsc fails on a missing key). A new language: copy `en.tsx`, translate, add one line to
  `LANGUAGES` in `i18n.ts`. Each language is its own Vite chunk inside the bundle (embedded in the
  `.elf`, listed in the AppCache manifest; nothing is downloaded), loaded by `initLang` before the
  first render (both entries) and by `setLang` before a switch shows it. Components use
  `useMessages().<group>`, other code `msg().<group>` at call time (never at module load); plurals via
  `plural`, numbers via `num`; a sentence is one message per language, never spliced from fragments;
  code compares ids, not displayed text. `http-client.ts`/`launcher.ts` stay free of runtime imports
  (plain-node checks) and return codes the UI translates. The system languages pick the language
  (exact tag, then its primary subtag) until the About tab's selector (System + each language, every
  platform) does. Game titles come from param.json's `localizedParameters` (`title_names` in
  `Inspection`/`LibraryEntry`; `gameTitle`): the chosen language, else the system languages, else
  English, else `title_name` (the default language, still used for generated names and sorting).
  Every UI copy change updates every language; the UI says "game", never "dump" (except the product
  names). Russian writes trace terms as трейс/трейсы/трейсинг. Arabic is right-to-left (`rtl` in
  `LANGUAGES`: `<html dir="rtl">`; styles.css uses logical properties plus a few `[dir="rtl"]` overrides,
  paths stay LTR) with Latin digits (`numbers`), and its Latin file names and paths are wrapped in
  LRI…PDI (U+2066/U+2069) so the bidi algorithm can't reorder them. Durations are whole messages per
  language (`duration`). The server's PS5 notifications (started, port in use, stopped, can't
  close (jobs running), not taken over; `crates/ps5-dump-forge-server/src/notice.rs`) follow the console's language
  (`sceSystemServiceParamGetInt` LANG, mapped to the UI's languages, else English); English elsewhere.
- No settings and no config file: the UI keeps choices in memory until it closes, except the UI
  language, which `localStorage` keeps (`forge.lang`; by user decision; unreadable storage falls back to
  the system languages). Defaults: Convert's target
  fpkg (`.pkg`), exfat for a `.pkg` source (by user decision; picker order Folder, fpkg, exfat, ffpfsc, ffpkg,
  ffpfs), exFAT inside a `.ffpfsc` at zlib
  level 6, all cores for compression (`serve`: cores − 1; PS5: its 5 CPUs − 2), `.pkg` Kraken level `fast` (also `balanced`,
  `smallest`, and `stored`: every block raw, the fallback for a console that won't start a compressed
  package; tests use `fast` only), no extra free space beyond each format's built-in spare, output next
  to the source (an empty output `dir` is the source's folder, never the process's working directory).
- Progress is one bar per job: `Event::Progress` `done`/`total` span every pass (write, verify,
  ...); `Ctx::expect_rest` renews the estimate as each pass learns its size. No pass fills the bar while
  another is left: LZ4 measuring and auto-loose sampling count the write and check passes after them,
  and `Ctx::reserve` holds back a packed image's check through its packs while it is checked as written.
  The UI keeps the bar under 100% until `Done` is `Ok`. Each job first emits `Event::Stages`
  (`{"kind":"stages","job":N,"stages":[...]}`, from `convert::stages(req)`: the `Progress` stage ids
  in order; Tauri `job://stages`, server `GET /api/jobs` `jobs[].stages`, `[]` until known); core's
  test helper `run` holds every job to it (reported stages only move forward through the list).
- The Tauri app has no HTTP sidecar and no `tauri-plugin-fs`; the capability grants only the app's
  commands, dialogs and event listening. The web UI is a separate build served by `serve`.
- Verification: fast by default everywhere (every structural check + seeded BLAKE3 sample of 8 MiB
  slices), full is opt-in (`full_verify`, `--full-verify`, the "Full verification" switch). A fast `.pkg`
  also samples the builder's own block sweep and `playgo-chunk.crc` check (vendor patch 0012, the job's seed).
- Updates (by user decision): every start checks GitHub, always on, no setting, nothing stored (`localStorage`
  keeps only `forge.lang`); **Later** hides the toast for the session. `app/src/update.ts` (no runtime imports;
  `scripts/check-update.mjs`): `GET api.github.com/repos/quer3q/ps5-dump-forge/releases/latest` (10 s, no
  cookies, any error = no toast), `tag_name` `vX.Y.Z` newer than the running version (a prerelease is older than
  its release) and the release lists this build's exact asset (`ps5-dump-forge-<v>-<asset>`, `state`
  `uploaded`, `size` > 0). The toast shows only after a successful check that found an installable update; any
  failure (offline, DNS, HTTP, JSON, timeout) is silent: no toast, no error, no offline state. `UpdateToast.tsx`
  (bottom-right, `role="status"`, once per start). Transport `updateTarget()` (`{version, asset}`, null = no
  updates) and `startUpdate(v)`. Desktop: Tauri `update_target` (asset by OS/arch, `-webview2` when a `WebView2`
  folder sits beside the exe) and `open_update {version}` (plain `X.Y.Z`; opens the release archive's URL in the
  browser via `open_url`, no self-replace; CSP `connect-src` has `https://api.github.com`). PS5 (`ps5.elf`, only
  while `GET /api/elfldr` says `{"up": true}`: a 1 s connect to elfldr, closed at once): `POST
  /api/self_update {version}` asks elfldr (`Options.elfldr`, `127.0.0.1:9021`) for `GET /?uri=<release
  .elf?args=serve&pipe=0>`; the page then polls `GET /api/session` for a new `instance` (1 s; 1 min in all from the request, download included) and
  reloads through AppCache; the old server never stops itself. Any newly loaded copy, of any version (by user
  decision: older and the same too), that finds Forge on the port closes it when idle and takes over
  (handover: `quit {"if_idle": true}` for one with session `handover: true`; for v0.1.1 and older, a `GET
  /api/jobs` with every job `done` first, then a plain `quit`; a running job always refuses: "Can't close
  Dump Forge - some jobs are still running."; details in `ps5/README.md`). `serve` on a computer (`host`): no update check.
- PS5 payload: one plain `.elf`, no PKG, no signing (updates: above, or replace the file). FreeBSD 11 ABI via
  `--cfg libc_unstable_freebsd_version="11"` (the env var is ignored by libc ≥ 0.2.187) and struct-size
  asserts in the CLI. `panic=abort`.
- The server has **no protections** by user decision: no pairing, token, Host/Origin/CSRF checks or path
  confinement. Don't re-add them. Its one delete route (`delete_path`, Inspect's and Library's, by user decision)
  refuses only what exception 3 lists; the page's question is UI, not authentication.
- The PS5 version is named "Dump Forge" (tile, notices, server texts, the web build's UI: `APP_NAME` in
  `api.ts`, the http page title); the desktop app is "PS5 Dump Forge". The CLI, crates,
  `ps5-dump-forge.elf` and release names keep `ps5-dump-forge`. Home folder `/data/dumpforge`
  (`FORGE_DIR`); `entry.c` moves an old `/data/ps5-dump-forge` there once and leaves a relative link at
  the old path (the Library walk doesn't follow it; details in `ps5/README.md`).
- Tile `PDFG00001` "Dump Forge" (deeplink to `http://127.0.0.1:<port>/`), never written without our owner
  file `/data/dumpforge/tile-PDFG00001.owner` (the old-name owner record still counts; see `ps5/README.md`).
  Self copy: `ps5/build.sh` builds twice; the release ELF embeds stage 1 and saves it to
  `/data/dumpforge/ps5-dump-forge.elf`. Launch on open: the AppCache'd page asks elfldr
  (`GET :9021/<elf>?args=serve`; that copy, then the old path, then USB) only from the console's own
  browser at load.
  On the PS5 the start notice only says "Dump Forge is launched" (no URL; the serve log has it); the page header
  shows the server's host:port from `GET /api/session` `url`, never the viewer's `location`, then its QR
  code (`GET /api/qr`: an SVG drawn by the server with the `qrcode` crate; 404 when the server can't tell
  its IP). The address + QR is one button that opens "How to connect"; About names the address. The
  desktop app shows no QR.
- PS5 writes: a retried fsync fails the job; the destination probe decides what a drive supports (never
  the path or fs name) and fails closed. Debug routes (`FORGE_DEBUG_API`) never ship; `release-ps5.sh`
  refuses them.

## Format rules (ShadowMountPlus 1.7)
- Raw filesystem at byte 0, no MBR/GPT; SMP attaches the whole file. The extension picks the driver, so it
  must match (`.ffpkg` UFS, `.exfat` exFAT, `.ffpfs` PFS, `.ffpfsc` PFSC); an inner image in `.ffpfsc` keeps
  its extension.
- `sce_sys/param.json` + `eboot.bin` at the image root. Image sizes are multiples of 64 KiB.
- exFAT: 512-byte sectors, 64 KiB clusters (boot-sector shifts 9/7); size as upstream `mkexfat_macos.sh`
  (0.5% spare, 64..512 MiB). The fast path also needs the file directly under `/data` or `/user`.
- UFS2: `newfs -O 2 -b 65536 -f 65536 -m 0 -S 4096`, `-i` = (data + spare)/(entries+2048) rounded down to
  4 KiB, clamped 64K..256K; size = the smallest layout holding the data, 1024 free blocks (64 MiB) and 2048
  spare inodes (no UFS2Tool `-D` +10%); every inode 0777 root:root; the last cylinder group must hold its
  full metadata (never write past `fs_size`).
- Writable (`image_rw=`) mounts need free blocks/inodes (UFS) or free clusters (exFAT); `.ffpfsc` is always
  mounted read-only.
- PFS (`.ffpfs`): version 2, 64 KiB blocks (the console misreads smaller ones), 32-bit unsigned inodes,
  case-insensitive (mode 0x8), unencrypted; byte-identical to `mkpfs pack folder --raw --no-compress
  --version PS5 --inode-bits 32 --block-size 65536` except that empty directories are kept. Inodes: super-root,
  flat path table, collision resolver (only if two paths' FPT hashes collide), uroot, dirs, files; every node's
  data is contiguous. Files are stored uncompressed (per-file PFSC passes verify but the console misreads it).
  Names: ASCII only, no case collisions, every offender listed.
- `.ffpfsc`: a single-file PFS (MkPFS `pack file` layout) whose one file is a zlib PFSC container of 64 KiB
  blocks around a nested `.exfat`/`.ffpkg`/`.ffpfs` named `<TITLE_ID>.<ext>` (default exFAT, MkPFS's most
  stable). Always PFSC, zlib level 0–9 as zlib numbers them (the slider, `--level`, `ffpfsc_level`;
  default 6; 0 stores every block raw); a block is kept compressed only if it saves ≥ 5%; a block with
  near-8-bit byte entropy that level 1 shrinks < 2% skips the level's search (stored raw). zlib from
  `flate2` (`miniz_oxide`). Streamed: the inner writer feeds the compressor, which writes the `.part`;
  no temporary inner image. Free-space preflight asks for the worst case (every block raw).
- Maker's mark `PS5-FORGE-v<version>` (≤ 31 bytes, a const assert in `convert.rs`): `.exfat` in an OEM
  Parameters record (sector 9, our GUID `{182B1321-1B2D-441D-BECA-28B704837CA0}` + 32 bytes ASCII, in both
  boot regions, under the boot checksum), `.ffpkg` as `fs_volname` in every superblock, `.ffpfsc` in its
  inner `.exfat`/`.ffpkg`. `.ffpfs` and `.pkg` carry none (no field for it). `inspect` reports `forge_version`.
- Image names: SMP mounts at `/mnt/shadowmnt[/pfsc]/<stem>_<8 hex>` and FreeBSD 11's MNAMELEN is 88
  (longer fails with ENAMETOOLONG), so the stem (the name without its extension) is ≤ 63 bytes for
  `.exfat`/`.ffpkg`/`.ffpfs` and ≤ 58 for `.ffpfsc` (`preflight::stem_limit`); preflight refuses a longer
  typed name. Folders and `.pkg` keep to the same 63 bytes, so every output follows one rule. Generated names
  are `[GAME_TITLE]-[TITLE_ID]` (`-2`, `-3`, ... when taken); the game title is cut first.
- FPKG: outer PFS plaintext with the `PPRPLAIN-NOAUTH!` marker (native AES-XTS fails the console's auth),
  inner image Kraken-compressed (zlib metadata is rejected by the console, never offer it).
- LZ4 packs (ampr_emu 0.4.2.1): index at `ampr_assets.index` (AMPRPAK4, little-endian, CRC32, FNV-1a path hashes)
  with `.crc` sidecar and `ampr_assets-NNN.pak` volumes (AMPRDAT3, volume cap 4 GiB - 64 KiB for FAT32); chunks LZ4 or RAW
  (a RAW chunk is exactly one I/O page); files the runtime cannot serve stay loose. CRCs detect
  corruption, they do not authenticate. The manifest's runtime-contract checks run on every open.
  Not an SMP image: ShadowMountPlus mounts none (no `.lz4` extension, no mount name limit beyond a folder's).

## Commands
```sh
cargo fmt --all --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace --release
(cd app && npm ci && npm run tauri dev)                       # GUI in dev mode
cargo run -p ps5-dump-forge-cli -- convert <game_dir> --to exfat   # or ffpkg | ffpfs | ffpfsc | pkg | folder
cargo run -p ps5-dump-forge-cli -- convert <game_dir> --to lz4 [--lz4-profile x.toml]   # asset packs (folder out)
cargo run -p ps5-dump-forge-cli -- convert <game_dir> --to folder --lz4-trace [--lz4-trace-space MiB]   # install the trace runtime (also --to exfat|ffpkg)
cargo run -p ps5-dump-forge-cli -- convert <packed_dir> --to folder --lz4-unpack   # back to the loose assets
cargo run -p ps5-dump-forge-cli -- lz4-patch <game_dir>   # IN PLACE: trace runtime, fresh index, stale journal/logs removed
cargo run -p ps5-dump-forge-cli -- lz4-unpatch <game_dir>   # IN PLACE: release runtime, fresh index, journal/logs removed
cargo run -p ps5-dump-forge-cli -- convert <img.ffpkg> --lz4-trace --lz4-in-place   # REPLACES the image (also .exfat; --lz4-unpatch)
cargo run -p ps5-dump-forge-cli -- convert <game_dir> --to lz4 --lz4-traces <x-amprtrace.zip|folder>   # pack with traces from the console
cargo run -p ps5-dump-forge-cli -- convert <game_dir> --to ffpkg --lz4-pack [--lz4-traces <zip>]   # pack straight into an image (also exfat|ffpfs|ffpfsc)
cargo run -p ps5-dump-forge-cli -- lz4-profile <game_dir> [--lz4-traces <zip>] [-o x.toml]   # Save as profile: the pack plan as TOML
scripts/check-lz4.sh <lz4_out_dir> <orig_dir> | --reverse   # upstream Python tools (Docker) inspect/verify our packs, unpack theirs
cargo run -p ps5-dump-forge-cli -- convert <game_dir> --to ffpfsc --inner exfat   # inner: exfat | ffpkg | ffpfs; --level 0..9
cargo run --release -p ps5-dump-forge-pfs --example pfs_tool -- ffpfs <dir> <out> <time>   # for MkPFS byte comparisons
scripts/check-exfat.sh <img.exfat> [src_dir]   # macOS fsck_exfat + mount compare + exfatprogs (Docker)
scripts/fsck-ufs.sh <img.ffpkg>...             # FreeBSD fsck_ufs -n in qemu (Docker, ~1 min)
scripts/check-versions.sh                      # Cargo.toml/tauri.conf.json/package.json versions agree
scripts/release-macos.sh                       # universal zip: PS5 Dump Forge.app + CLI, ad-hoc signed
scripts/release-windows.sh                     # Git Bash on Windows: x86-64 zip + x86-64-webview2 zip, or one arm64 zip
scripts/release-linux.sh                       # Linux: x86-64 or arm64 tarball by host (extracted AppDir + forge.sh + CLI)
cargo run -p ps5-dump-forge-cli -- serve --root <dir>   # the web UI on this computer (cd app && npm run build:http first)
ps5/build.sh                                   # PS5 payload in Docker: target/ps5/ps5-dump-forge.elf
ps5/test-entry.sh                              # host check of entry.c
scripts/release-ps5.sh                         # dist/ps5-dump-forge-<ver>-ps5.elf, checked (SKIP_BUILD=1: check only)
scripts/test-freebsd.sh                        # core + server tests on FreeBSD UFS/FAT32/nullfs (VM; long)
FORGE_DEBUG_API=1 ps5/build.sh                 # bring-up build with POST /api/debug; never released
```
`tauri build` needs an absolute `CARGO_TARGET_DIR` if you set one.

## Preferences
- Do not commit, push or stage unless asked.
- Rust 2024 edition, latest stable (`rust-version` tracks it). CI is unpinned and latest on purpose.
- Keep code small and boring (stdlib first, no speculative abstractions; `// ponytail:` notes name
  the ceiling of a deliberate shortcut).
- Changes to `vendor/` go into a new numbered patch in `vendor/patches/` and `vendor/README.md`.
  Don't replace `vendor/` with our own code unless asked.
- Before release: hardware smoke test per format (SMP 1.7 mounts and boots `.exfat`/`.ffpkg`/`.ffpfs` and
  `.ffpfsc` with each inner format; `.pkg` installs and boots), and the PS5 payload (page loads, a conversion
  on `/data`, Stop).
