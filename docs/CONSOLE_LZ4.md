# Console-policy LZ4 CLI

This private downstream fork preserves quer3q/ps5-dump-forge v0.4.2 history and replaces its packing selection and encoder with the console compressor’s original C policy and bundled LZ4 1.10.0. Source provenance and licenses are recorded in `crates/ps5-dump-forge-lz4/native/console/ORIGIN.md`.

## Convert directly to an ffpkg

```bash
./ps5-dump-forge convert PPSA31246.exfat \
  --to ffpkg --lz4-pack --lz4-level 9 \
  -o PPSA31246-console-lz4.ffpkg --full-verify
```

Use a new output path and retain the original source. The ffpkg contains LZ4 asset packs and loose boot files; it is not a single raw LZ4 stream. `--to lz4` produces a packed folder instead. The game must use AMPR. Existing upstream runtime requirements and warnings still apply.

`--lz4-level` accepts 1–12; default 9 is HC9. Levels 1–4 use the original fast encoder settings; 5–12 use HC. Existing `--level` controls PFSC zlib, not LZ4. Automatic selection uses bundled title/engine profiles when matched, otherwise the original universal policy. An explicit `--lz4-profile` overrides automatic profile choice; traces narrow selection. Numbered root `.pak` archives can be packed. Boot files, empty files and protected paths remain loose according to console policy.

The fork carries over compression thresholds, default 64 KiB blocks, auto-loose sampling, hot/streaming rules, logical lanes, deduplication and runtime cache budgeting. It uses bounded metadata and two-pass image writing, without staging the full extracted game.

## Evidence and limits

The inspected console reports compressor v1.4.3. Its policy source was not directly available: the preserved v1.4.2 policy and v1.5.0 source are identical apart from license headers, and that policy remains unchanged through v1.6.4. The v1.4.3 keep-on-disk fix is reproduced explicitly.

A PPSA31246 metadata regression selects the same three files, totaling 97,296,759,947 logical bytes, as the console history. Independent synthetic comparisons against the original C packing engine pass for levels 1, 9 and 12, streaming, hot 16 KiB blocks and disabled deduplication. These compare file selection, flags, stored chunk bytes and unique payload accounting. Linux x86-64 formatting, Clippy and release-mode non-GUI workspace tests pass.

Forge retains its own physical volume placement, naming and approximately 4 GiB volume limit; the console uses a different layout and larger volumes. Pack sets and final image sizes are therefore not byte-identical. The console’s roughly 105 GiB result is not a guaranteed ffpkg size. No full-game conversion or PS5 playback validation was performed for this fork.

Deduplication metadata is capped at 128 MiB; oversized jobs disable deduplication while retaining selection and compression settings. Non-64-KiB I/O page profiles are explicitly rejected. Runtime budgets are resolved against the actual generated manifest. GUI, Windows and PS5 builds are unvalidated; the C policy uses POSIX APIs.

## Reproduce the Linux release

```bash
scripts/build-console-linux.sh amd64
```

Requires Docker. The build runs formatting, Clippy, release-mode non-GUI workspace tests and all six C-engine differential comparisons. Output: `dist/console-linux-amd64/ps5-dump-forge`. The Linux binary targets glibc 2.36+ and requires the normal C/C++ runtime libraries (including libstdc++6). No PS5 SDK is required. The script also accepts `arm64`, which is not part of this validated release.
