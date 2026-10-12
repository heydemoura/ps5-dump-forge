<p align="center"><img src="app/src-tauri/icons/128x128@2x.png" width="128" alt="PS5 Dump Forge"></p>

Runs on everything (including your PS5) and converts everything: **folder**, **exfat**, **ffpfs**, **ffpfsc**, **pkg** and can utilize **LZ4 compression**.
Supoort more than a 10 different languages.

| Platform | Runs on | You get |
|---|---|---|
| **PS5** | Jailbroken, with an ELF loader | The payload (`.elf`); the UI opens in any browser |
| **macOS** | 11 or later, Apple Silicon and Intel (one universal zip) | App + CLI |
| **Windows** | 10 or 11 on x86-64, 11 on arm64 | App + CLI |
| **Linux** | x86-64 or arm64, glibc 2.35+ (e.g. Ubuntu 22.04+) | App (no install, no FUSE) + CLI |

## Features

- **Any source to any target**, streamed straight through: no temporary copy, not even the image inside a `.ffpfsc`.
- **LZ4 compression**, new experimental way to pack ampr_emu enabled games.
- **Library**, to convert and edit dumps.
- **Never touches your dump** unless you ask (LZ4 Patch/Unpatch, Inspect's Delete): junk (`.DS_Store`, `._*`, ...) is skipped, not deleted; bad file names are reported up front, never renamed.
- **Inspect** a dump or image: cover, title, required firmware, backport firmware (`fakelib/`), embedded DLC, `param.json`, leftover `.part` files.
- **Delete** the inspected dump or image can be easily deleted.
- **Runs on the PS5 itself**: converts on the console's own storage, driven from its browser or any browser on the network.
- **Writes onto USB sticks and SD cards** formatted exFAT or FAT32.
- **Fast**: maybe fastest it can get.

## Formats

Images are mounted by [ShadowMountPlus](https://github.com/drakmor/ShadowMountPlus); the debug FPKG is
installed. Every format can be created and read back (an image or `.fpkg` can be extracted to a folder).
**PS5** is the conversion speed on the console itself (internal SSD, from a Hades II `.pkg`, full
verification; `.ffpfsc` at level 1).

| Format | Console speed | PS5 | Size on disk | Notes |
|---|---|---|---|---|
| `.fpkg` (debug FPKG, saved as `.pkg`) | Native, full speed | 80 MB/s | 30–60% less, depending on the game | Installs on firmware 11.60 or lower with kstuff + fpkg-enable + ppr-patch. Kraken level (`--kraken`): **Fast** (default), **Balanced** / **Smallest** ≈ 2.6% smaller at ~6× / ~9× the compression time. Reads packages from this builder and compatible debug builders. |
| `.ffpkg` (UFS2) | Full image speed | 230 MB/s | Equal to the game size | The default, ShadowMountPlus's recommendation. |
| `.exfat` (512 B sectors, 64 KiB clusters) | Full image speed | 230 MB/s | Equal to the game size | For games that only run like external-drive content. |
| `.ffpfs` (PFS, uncompressed) | Full image speed | 240 MB/s | Equal to the game size | Experimental in ShadowMountPlus. ASCII file names only. |
| `.ffpfsc` (compressed PFS container) | may stutter | 120 MB/s | Depends on the compression level, usually 30–60% less | Experimental, always mounted read-only. exFAT (default), UFS2 or PFS inside. zlib level 0–9 (`--level`), default 6. |
| Folder | Full drive speed | 240 MB/s | Equal to the game size | Run as it is by ShadowMountPlus. |

## LZ4 asset packs

Experimental, and only for games whose `eboot.bin` imports `libSceAmpr` (AMPR titles). Forge LZ4-compresses
a game's assets into `ampr_assets-NNN.pak` volumes that the [ampr_emu](https://github.com/drakmor/ampr_emu)
runtime, installed under `fakelib/`, reads back on the console; the result is a plain game folder, or an
image holding one. Everything is in the app's **LZ4** tab:

1. **Trace**: make a plain `.ffpkg`, patch it (**LZ4** → **Trace** → **Patch**), mount it writable
   (`image_rw=`) with ShadowMountPlus and play one long session.
2. **Download traces**: close the game, wait about a minute, open the console's Forge in a computer's
   browser and choose **Download traces** on that image (one zip).
3. **Pack** the original dump on the computer: **LZ4** → **Pack/Unpack**, pick the zip under **Traces** and
   a target (LZ4 packed folder, `.ffpkg`, `.exfat` or `.ffpfs`).

Without traces or a profile, Pack falls back to a built-in guess of which files to pack, which is less reliable.
ampr_emu 0.4.2.1 is an upstream test build: some games crash when saving. Details, CLI options and
caveats: [docs/LZ4.md](docs/LZ4.md).

## Benchmarks on PC

| From the `.pkg` to | Time | Speed | Output |
|---|---|---|---|
| Folder | 11.1 s | 831 MB/s | 9.23 GB |
| `.exfat` | 9.4 s | 978 MB/s | 9.60 GB |
| `.ffpkg` | 12.1 s | 761 MB/s | 9.61 GB |
| `.ffpfs` | 9.4 s | 981 MB/s | 9.50 GB |
| `.ffpfsc` (exFAT inside, level 6) | 19.0 s | 486 MB/s | 8.58 GB |
| `.fpkg` (Kraken Fast) | 40.5 s | 228 MB/s | 8.53 GB |

MacBook Pro M3 (Apple M3 Max).

## Download and run

Every release archive on the Releases page holds the app, the `ps5-dump-forge` command-line tool,
README.md, LICENSE and THIRD-PARTY-NOTICES.md. Nothing to install; the app writes nothing beyond its own
WebView data, so keep it in any folder you can write to.

### PS5 (jailbroken, with an ELF loader)

- **Load it** with any ELF loader: send `ps5-dump-forge-<version>-ps5.elf` to elfldr's port 9021
  (`nc -w 3 <ps5-ip> 9021 < ps5-dump-forge-<version>-ps5.elf`), or list it in an autoloader's
  `autoload.txt`. A notification says Dump Forge is launched; open it from its icon.
- **Open the UI** from the Dump Forge tile, or in any browser on the same network:
  `http://<ps5-ip>:8095`.

### macOS (11 or later)

Get `ps5-dump-forge-<version>-macos-universal.zip` (Apple Silicon and Intel) and unzip it anywhere.

The app is ad-hoc signed only (no Apple Developer ID, not notarized), so macOS blocks the first launch ("PS5
Dump Forge is damaged" or "cannot be opened"). Use **one** of these:

1. **Terminal** (every macOS version), in the folder that holds the app, then double-click it:

   ```sh
   xattr -dr com.apple.quarantine "PS5 Dump Forge.app"
   ```

2. **System Settings.** Double-click the app once and dismiss the warning, then in System Settings → Privacy
   & Security, scroll down to the message about PS5 Dump Forge and click **Open Anyway**.

### Windows (10 or 11 on x86-64, 11 on arm64)

- x86-64: `ps5-dump-forge-<version>-windows-x86-64.zip` uses the Microsoft Edge WebView2 Runtime, which
  Windows 11 and most Windows 10 PCs already have. Without it, get `...-windows-x86-64-webview2.zip`: larger,
  with its own copy of the runtime in a `WebView2` folder.
- arm64: `ps5-dump-forge-<version>-windows-arm64.zip` (uses the WebView2 Runtime Windows 11 ships).

Extract it to a folder you can write to (not Program Files, not a network share): `PS5 Dump Forge.exe` keeps
its WebView data in a `data/webview` folder beside itself. The app is unsigned, so SmartScreen may block the
first launch: click **More info**, then **Run anyway**. If WebView2 is missing or broken, the app says what to
do instead of showing a blank window.

### Linux (x86-64 or arm64, glibc 2.35 or later, e.g. Ubuntu 22.04 or newer)

Extract `ps5-dump-forge-<version>-linux-x86-64.tar.gz` or `...-linux-arm64.tar.gz` (`tar -xzf`) to a folder
you can write to and run `./forge.sh`. No FUSE, no install; keep `PS5 Dump Forge.AppDir` next to `forge.sh`
(its WebView data goes in a `data/webview` folder beside it).

### Command-line tool

Every desktop archive also has `ps5-dump-forge` (`ps5-dump-forge.exe` on Windows):

```sh
./ps5-dump-forge inspect PPSA01234.exfat
./ps5-dump-forge convert ~/Games/PPSA01234 --to ffpkg      # folder | exfat | ffpkg | ffpfs | ffpfsc | pkg (debug FPKG)
./ps5-dump-forge convert ~/Games/PPSA01234 --to ffpfsc --inner exfat   # inner: exfat (default) | ffpkg | ffpfs
./ps5-dump-forge convert ~/Games/PPSA01234 --to ffpfsc --level 6        # zlib level 0 (store) .. 9 (smallest), default 6
./ps5-dump-forge convert ~/Games/PPSA01234 --to pkg --kraken fast       # fast (default) | balanced | smallest
./ps5-dump-forge convert ~/Games/PPSA01234 --to exfat --full-verify     # check every byte, not a sample
```

## Build

Rust (latest stable) and Node.js:

```sh
cargo test --workspace --release
cd app && npm ci && npm run tauri dev
```

On Linux the app also needs Tauri's WebKitGTK build dependencies (Debian/Ubuntu package names, as CI
installs them):

```sh
sudo apt-get install libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libayatana-appindicator3-dev patchelf file
```

The PS5 payload builds in Docker (any macOS or Linux host with Docker and Node) with `ps5/build.sh`; the
rest of its commands are in [ps5/README.md](ps5/README.md).

See [AGENTS.md](AGENTS.md) for the layout and the format rules, and [DESIGN.md](DESIGN.md) for the UI design
system.

## Thanks

Big thanks to **[PhantomPtr](https://github.com/phantomptr)** for
**[ps5upload](https://github.com/phantomptr/ps5upload)**. Its Rust engine is the reference implementation this
project learned the PS5 formats from: the FPKG package builder and reader (PFS, PFSC, Kraken, CNT/FIH,
PlayGo, debug license), and the exFAT and UFS2 readers. Its crates are vendored here (`vendor/`, v6.1.2).

Big thanks to **[drakmor](https://github.com/drakmor)**, author of
**[ShadowMountPlus](https://github.com/drakmor/ShadowMountPlus)**, for the mount side this tool writes for and
for help along the way: the image-building scripts (`mkexfat_macos.sh` and friends) whose sizing and layout
rules the `.exfat`/`.ffpkg` writers follow, the format guidance in SMP's README and release notes, and ppr-patch,
which makes debug `.pkg` installs possible.

Thanks again to **[drakmor](https://github.com/drakmor)** for **[ampr_emu](https://github.com/drakmor/ampr_emu)**
(GPL-3.0-or-later), the runtime that makes LZ4 asset packs work: its 0.4.2.1 release and trace runtimes are embedded
unmodified, with their source archive in `vendor/ampr_emu/`. **[Lazy_AMPR](https://github.com/Nazky/Lazy_AMPR)**
by Nazky was the reference for the trace-then-pack workflow (no code taken). The bundled LZ4 (BSD-2-Clause)
and HDE64 notices are in `THIRD-PARTY-NOTICES.md`.

Credits for other references are in `THIRD-PARTY-NOTICES.md`.

## License

GPL-3.0-or-later. See `LICENSE`.
