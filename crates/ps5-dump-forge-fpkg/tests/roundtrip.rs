//! Packages built by the vendored builder read back, byte for byte, as their effective manifest.

mod common;

use common::{BIG, BIG_LEN, Rng, assert_matches, build, error_of};
use ps5_dump_forge_fpkg::{FpkgSource, WRONG_PASSCODE};
use ps5upload_fpkg::ImageMode;
use ps5upload_fpkg::source::SourceTree;

#[test]
fn a_kraken_package_reads_back_as_its_manifest() {
    let built = build("kraken", 0, |_| {});
    let mut source = FpkgSource::open(&built.path, None).unwrap();
    assert_matches(&mut source, &built);
    // The artwork the builder moved into the container is served from there.
    assert_eq!(
        built.container_only,
        [
            "sce_sys/icon0.png",
            "sce_sys/pic0.png",
            "sce_sys/pic1.png",
            "sce_sys/pic2.png",
            "sce_sys/snd0.at9"
        ]
    );
    assert!(built.empty_dirs.contains(&"data/empty".to_string()));
    let details = source.details().join("\n");
    assert!(details.contains(common::CONTENT_ID), "{details}");
    assert!(details.contains("layout: Kraken"), "{details}");
    assert!(details.contains("plaintext"), "{details}");
    assert!(source.describe().contains(common::CONTENT_ID));
}

#[test]
fn unaligned_ranges_of_a_multi_block_file_match() {
    let built = build("ranges", 0, |_| {});
    let want = built.bytes(BIG);
    assert_eq!(want.len(), BIG_LEN);
    let mut source = FpkgSource::open(&built.path, None).unwrap();
    let mut rng = Rng::new(99);
    for _ in 0..300 {
        let offset = rng.below(BIG_LEN as u64 + 100) as usize;
        let len = rng.below(700_000) as usize;
        let got = source.read_range(BIG, offset as u64, len).unwrap();
        let start = offset.min(BIG_LEN);
        let end = offset.saturating_add(len).min(BIG_LEN);
        assert!(got == want[start..end], "{offset} + {len}");
    }
    // Sequential reads of more than two blocks, each starting in the block the last one ended in.
    let mut got = Vec::new();
    while got.len() < BIG_LEN {
        got.extend(source.read_range(BIG, got.len() as u64, 600_001).unwrap());
    }
    assert!(got == want, "sequential");
    // Block boundaries of the 256 KiB Kraken blocks, from either side.
    for k in 1..5u64 {
        let at = k * 256 * 1024;
        let got = source.read_range(BIG, at - 3, 7).unwrap();
        assert_eq!(got, want[at as usize - 3..at as usize + 4]);
    }
    assert!(source.read_range(BIG, u64::MAX, 10).unwrap().is_empty());
    assert!(source.read_range("no/such/file", 0, 10).is_err());
}

#[test]
fn a_native_package_needs_its_passcode() {
    let built = build("native", 0, |r| {
        r.image_mode = ImageMode::Native;
        r.seed = Some([0x5A; 16]);
    });
    let mut source = FpkgSource::open(&built.path, None).unwrap();
    assert!(source.details().join("\n").contains("native AES-XTS"));
    assert_matches(&mut source, &built);
    let e = error_of(FpkgSource::open(
        &built.path,
        Some("11111111111111111111111111111111"),
    ));
    assert!(e.starts_with(WRONG_PASSCODE), "{e}");
}
