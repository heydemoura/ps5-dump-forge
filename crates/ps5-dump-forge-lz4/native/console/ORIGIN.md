# Console packing policy and encoder

Unmodified `ampr_pack_profile.c`, `ampr_pack_toml.c`, and `ampr_pack_internal.h`
from theghostonline/PS5-LZ4-Compression commit
`a2b65ccdf7bc332486ef678e61cba516b169dbdb` (v1.5.0), GPL-3.0-or-later.
https://theghostonline.dev/theghostonline/PS5-LZ4-Compression

The policy source is identical to the v1.4.2 source preserved at
https://github.com/danthespal/PS5-LZ4-Compression/tree/cdf49eb90031e133dcb2e020816c466f2e2f89c5
apart from the added SPDX/copyright header. It remains unchanged through v1.6.4.
The console inspected for this fork reports v1.4.3. Its history reports HC level
9, auto profile, and the three PPSA31246 files totaling 97,296,759,947 bytes.
The v1.4.3 keep-on-disk fix is reproduced explicitly in `bridge.c`.

LZ4 1.10.0 is the exact copy bundled by that console source (BSD-2-Clause;
`LZ4-LICENSE`). Profiles are the bundled community profiles credited in
`profiles/index.json` (GPL-3.0). Original authors and notices are preserved.

`bridge.c` is this fork's bounded C ABI adapter. It runs the original policy on
Forge's file listing, without staging game content or giving the C policy
access to images, source game paths, or output files.
