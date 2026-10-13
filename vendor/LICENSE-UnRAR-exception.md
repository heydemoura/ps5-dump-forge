# UnRAR linking exception (and required notice)

PS5 Dump Forge ("Forge") is licensed under **GPL-3.0-or-later** (see `../LICENSE`). Its `.rar`
support is built on the **UnRAR** source code by Alexander Roshal, which the `unrar_sys` crate
bundles and compiles; Forge's own wrapper (`crates/ps5-dump-forge-archive/src/rar.rs`) calls its
C API. UnRAR is linked into every build: the desktop app, the `ps5-dump-forge` CLI and the PS5
payload (`ps5-dump-forge.elf`). It is **only used to extract RAR archives**: Forge does not, and
the UnRAR code here may not, be used to create RAR archives, to develop a RAR (WinRAR) compatible
archiver or to re-create the RAR compression algorithm.

UnRAR's own license is reproduced verbatim in `UnRAR-license.txt`. It allows free use in any
software that handles RAR archives but adds a field-of-use restriction, which the GPL counts as a
further restriction (GPLv3 §7). The copyright holders of Forge therefore grant the following
additional permission.

## Additional permission under GNU GPL version 3 section 7

> As a special exception, the copyright holders of PS5 Dump Forge give you permission to
> combine PS5 Dump Forge with the UnRAR source code (and the `unrar_sys` Rust crate that
> bundles it), and to convey the resulting work. You may extend this exception to your version
> of PS5 Dump Forge, but you are not obligated to do so. If you do not wish to do so, delete
> this exception statement from your version.

## Required UnRAR notice (UnRAR license, paragraph 2)

Reproduced as required, verbatim:

> UnRAR source code may be used in any software to handle RAR archives without
> limitations free of charge, but cannot be used to develop RAR (WinRAR)
> compatible archiver and to re-create RAR compression algorithm, which is
> proprietary. Distribution of modified UnRAR source code in separate form or
> as a part of other software is permitted, provided that full text of this
> paragraph, starting from "UnRAR source code" words, is included in license,
> or in documentation if license is not available, and in source code comments
> of resulting package.
