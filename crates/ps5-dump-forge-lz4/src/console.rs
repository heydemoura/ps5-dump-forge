//! Console policy and LZ4 1.10.0, through a small ABI over the original C sources.
//! Game data stays in Forge's SourceTree; only path/size metadata enters the policy.
use std::ffi::{CStr, CString, c_char, c_int};
use std::path::Path;

use crate::{AutoLoose, PackSpec, RuntimeProfile};

const BUNDLED: [(&str, &str, &str, &str); 4] = [
    (
        "astrobot",
        "PPSA21567",
        "astrobot",
        include_str!("../native/console/profiles/astrobot.toml"),
    ),
    (
        "ufc6",
        "PPSA23566",
        "ufc6",
        include_str!("../native/console/profiles/ufc6-PPSA23566.toml"),
    ),
    (
        "insomniac",
        "PPSA03671",
        "wolverine",
        include_str!("../native/console/profiles/insomniac.toml"),
    ),
    (
        "unity",
        "PPSA28997",
        "sonsofsparta",
        include_str!("../native/console/profiles/unity.toml"),
    ),
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Encoding {
    pub hc: bool,
    pub level: i32,
    pub acceleration: i32,
    pub min_bytes: u64,
    pub min_ratio_bits: u64,
    pub neutral_bytes: u64,
    pub neutral_ratio_bits: u64,
    pub io_page: u32,
    pub streaming: bool,
    pub force_pack: bool,
    pub group: u32,
    pub lane: u32,
    pub lanes: u32,
    pub assignment: u32,
    pub dedup: bool,
    pub scope_group: bool,
    pub striped: bool,
    pub stripe_threshold: u64,
    pub stripe_blocks: u32,
}
impl Encoding {
    pub fn accepts(self, raw: usize, stored: usize) -> bool {
        let saved = raw as i64 - stored as i64;
        let (mut bytes, mut ratio) = (self.min_bytes, f64::from_bits(self.min_ratio_bits));
        if !self.streaming
            && stored.div_ceil(self.io_page as usize) >= raw.div_ceil(self.io_page as usize)
        {
            bytes = bytes.max(self.neutral_bytes);
            ratio = ratio.max(f64::from_bits(self.neutral_ratio_bits));
        }
        saved >= bytes as i64 && saved as f64 / raw as f64 >= ratio
    }
}
#[repr(C)]
#[derive(Default, Clone, Copy)]
struct RawSpec {
    selected: c_int,
    block_shift: c_int,
    store: c_int,
    hot: c_int,
    random: c_int,
    streaming: c_int,
    mode_hc: c_int,
    level: c_int,
    acceleration: c_int,
    force_pack: c_int,
    min_bytes: u64,
    min_ratio: f64,
    neutral_bytes: u64,
    neutral_ratio: f64,
    io_page: u32,
    group: c_int,
    lanes: c_int,
    assignment: c_int,
    dedup: c_int,
    scope: c_int,
    striped: c_int,
    stripe_threshold: u64,
    stripe_blocks: u32,
}
#[repr(C)]
#[derive(Default)]
struct Options {
    enabled: c_int,
    hot: c_int,
    min_file_size: u64,
    sample_blocks: u32,
    sample_bytes: u64,
    min_savings_ratio: f64,
    max_raw_ratio: f64,
    has_runtime: c_int,
    auto_budget: c_int,
    decoded_cache: u64,
    physical_cache: u64,
    workers: u32,
    reserve: u32,
}
unsafe extern "C" {
    fn forge_console_policy(
        paths: *const *const c_char,
        sizes: *const u64,
        count: usize,
        profile: *const c_char,
        learn_dir: *const c_char,
        level: c_int,
        workers: c_int,
        out: *mut RawSpec,
        opts: *mut Options,
        err: *mut c_char,
        err_size: usize,
    ) -> c_int;
    fn forge_console_compress(
        src: *const c_char,
        size: c_int,
        dst: *mut c_char,
        cap: c_int,
        hc: c_int,
        level: c_int,
        accel: c_int,
    ) -> c_int;
}

pub struct Policy {
    pub specs: Vec<Option<PackSpec>>,
    pub auto_loose: AutoLoose,
    options: Options,
}
impl Policy {
    pub fn build(
        records: &[(String, u64)],
        profile: Option<&Path>,
        level: u8,
        workers: usize,
    ) -> Result<Self, String> {
        if records.len() > 2_000_000 {
            return Err("console policy exceeds the runtime file limit".into());
        }
        if !(1..=12).contains(&level) {
            return Err("LZ4 level must be 1..12".into());
        }
        let names: Vec<CString> = records
            .iter()
            .map(|(p, _)| CString::new(p.as_bytes()).map_err(|_| "NUL in game path".to_owned()))
            .collect::<Result<_, _>>()?;
        let pointers: Vec<_> = names.iter().map(|n| n.as_ptr()).collect();
        let sizes: Vec<_> = records.iter().map(|(_, s)| *s).collect();
        let profile = profile
            .map(|p| {
                p.to_str()
                    .ok_or_else(|| "non-UTF8 profile path".to_owned())
                    .and_then(|s| CString::new(s).map_err(|_| "NUL in profile path".to_owned()))
            })
            .transpose()?;
        let learned = tempfile::tempdir().map_err(|e| e.to_string())?;
        for (id, _, _, text) in BUNDLED {
            std::fs::write(learned.path().join(format!("{id}.toml")), text)
                .map_err(|e| e.to_string())?;
        }
        let learned_name = CString::new(learned.path().to_str().ok_or("non-UTF8 temporary path")?)
            .map_err(|e| e.to_string())?;
        let mut out = vec![RawSpec::default(); records.len()];
        let mut options = Options::default();
        let mut err = [0 as c_char; 1024];
        // SAFETY: all arrays have count entries; C borrows them for this call and owns none.
        let rc = unsafe {
            forge_console_policy(
                pointers.as_ptr(),
                sizes.as_ptr(),
                records.len(),
                profile.as_ref().map_or(std::ptr::null(), |p| p.as_ptr()),
                learned_name.as_ptr(),
                level.into(),
                workers.clamp(1, 64) as c_int,
                out.as_mut_ptr(),
                &mut options,
                err.as_mut_ptr(),
                err.len(),
            )
        };
        if rc != 0 {
            // SAFETY: the zero-filled buffer remains NUL terminated (C uses snprintf).
            return Err(unsafe { CStr::from_ptr(err.as_ptr()) }
                .to_string_lossy()
                .into_owned());
        }
        if out.iter().any(|s| s.selected != 0 && s.io_page != 65536) {
            return Err("this Forge writer requires 64 KiB I/O pages; the console profile requests another page size".into());
        }
        let specs = out
            .into_iter()
            .map(|s| {
                if s.selected == 0 {
                    None
                } else {
                    Some(PackSpec {
                        block_shift: s.block_shift as u8,
                        store: s.store != 0,
                        hot: s.hot != 0,
                        random: s.random != 0,
                        encoding: Some(Encoding {
                            hc: s.mode_hc != 0,
                            level: s.level,
                            acceleration: s.acceleration,
                            min_bytes: s.min_bytes,
                            min_ratio_bits: s.min_ratio.to_bits(),
                            neutral_bytes: s.neutral_bytes,
                            neutral_ratio_bits: s.neutral_ratio.to_bits(),
                            io_page: s.io_page,
                            streaming: s.streaming != 0,
                            force_pack: s.force_pack != 0,
                            group: s.group as u32,
                            lane: 0,
                            lanes: s.lanes as u32,
                            assignment: s.assignment as u32,
                            dedup: s.dedup != 0,
                            scope_group: s.scope != 0,
                            striped: s.striped != 0,
                            stripe_threshold: s.stripe_threshold,
                            stripe_blocks: s.stripe_blocks,
                        }),
                    })
                }
            })
            .collect();
        let auto_loose = AutoLoose {
            enabled: options.enabled != 0,
            hot: options.hot != 0,
            min_file_size: options.min_file_size,
            sample_blocks: options.sample_blocks,
            sample_bytes: options.sample_bytes,
            min_savings_ratio: options.min_savings_ratio,
            max_raw_ratio: options.max_raw_ratio,
        };
        Ok(Self {
            specs,
            auto_loose,
            options,
        })
    }
    pub fn runtime(&self, manifest_bytes: u64, index_bytes: u64) -> Option<RuntimeProfile> {
        let o = &self.options;
        if o.has_runtime == 0 {
            return None;
        }
        let (mut decoded, mut physical) = (o.decoded_cache, o.physical_cache);
        if o.auto_budget != 0 {
            let fixed = (32 * 2 + u64::from(o.workers) + 32 + 16) << 20;
            let avail = (384u64 << 20).saturating_sub(fixed + manifest_bytes + index_bytes);
            physical = (avail / 4).min(64 << 20);
            decoded = (avail - physical).min(256 << 20);
            physical = physical / 16384 * 16384;
            decoded = decoded / 16384 * 16384;
        }
        Some(RuntimeProfile {
            auto_budget_index_bytes: (o.auto_budget != 0).then_some(index_bytes),
            decoded_cache_bytes: decoded,
            physical_cache_bytes: physical,
            workers: o.workers,
            latency_reserve_workers: o.reserve,
        })
    }
}
/// Same largest-first balanced, ASCII-folded hash, or file-id round-robin lane assignment
/// as the console; run after auto-loose, since loose files contribute no lane load.
pub fn assign_lanes(files: &mut [crate::writer::PackFile]) {
    let mut groups = std::collections::BTreeMap::<u32, Vec<usize>>::new();
    for (i, f) in files.iter().enumerate() {
        if let Some(e) = f.spec.and_then(|s| s.encoding) {
            groups.entry(e.group).or_default().push(i);
        }
    }
    for ids in groups.values_mut() {
        let e = files[ids[0]].spec.unwrap().encoding.unwrap();
        if e.assignment == 0 {
            ids.sort_by(|&a, &b| {
                files[b]
                    .size
                    .cmp(&files[a].size)
                    .then_with(|| {
                        files[a]
                            .path
                            .to_ascii_lowercase()
                            .cmp(&files[b].path.to_ascii_lowercase())
                    })
                    .then(a.cmp(&b))
            });
        }
        let mut loads = vec![0u64; e.lanes as usize];
        for &i in ids.iter() {
            let lane = match e.assignment {
                1 => {
                    (crate::format::pak_hash(files[i].path.as_bytes()) % u64::from(e.lanes))
                        as usize
                }
                2 => i % e.lanes as usize,
                _ => loads
                    .iter()
                    .enumerate()
                    .min_by_key(|(_, v)| *v)
                    .map_or(0, |(n, _)| n),
            };
            loads[lane] += files[i].size;
            files[i]
                .spec
                .as_mut()
                .unwrap()
                .encoding
                .as_mut()
                .unwrap()
                .lane = lane as u32;
        }
    }
}

pub(crate) fn compress(raw: &[u8], settings: Encoding) -> Option<Vec<u8>> {
    // The AMPR contract caps blocks at 1 MiB; never truncate a larger usize into C's int.
    if raw.is_empty() || raw.len() > 1 << 20 || settings.io_page == 0 {
        return None;
    }
    let mut dst = vec![0u8; raw.len() + raw.len() / 255 + 16];
    // SAFETY: buffers are disjoint, sized as passed, and live throughout this synchronous call.
    let n = unsafe {
        forge_console_compress(
            raw.as_ptr().cast(),
            raw.len() as c_int,
            dst.as_mut_ptr().cast(),
            dst.len() as c_int,
            settings.hc.into(),
            settings.level,
            settings.acceleration,
        )
    };
    if n <= 0 || !settings.accepts(raw.len(), n as usize) {
        return None;
    }
    dst.truncate(n as usize);
    Some(dst)
}

pub fn bundled_profile(
    title: &str,
    name: &str,
    paths: &[&str],
) -> Option<(&'static str, &'static str)> {
    let normalized: String = name
        .chars()
        .filter(char::is_ascii_alphanumeric)
        .flat_map(char::to_lowercase)
        .collect();
    for &(id, title_id, hint, text) in &BUNDLED {
        if title == title_id || normalized.contains(hint) {
            return Some((id, text));
        }
    }
    if ["toc", "dag"].iter().all(|p| paths.contains(p)) && paths.iter().any(|p| p.starts_with("d/"))
    {
        return Some((BUNDLED[2].0, BUNDLED[2].3));
    }
    let streaming = paths
        .iter()
        .any(|p| p.starts_with("StreamingAssets/") || p.starts_with("Media/StreamingAssets/"));
    if streaming
        && paths.iter().any(|p| {
            [
                "Data/globalgamemanagers",
                "Data/data.unity3d",
                "Data/Managed/Metadata/global-metadata.dat",
                "Media/Data/globalgamemanagers",
                "Media/Data/data.unity3d",
                "Media/Data/Managed/Metadata/global-metadata.dat",
            ]
            .contains(p)
        })
    {
        return Some((BUNDLED[3].0, BUNDLED[3].3));
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    fn records(rows: &[(&str, u64)]) -> Vec<(String, u64)> {
        rows.iter().map(|(p, s)| (p.to_string(), *s)).collect()
    }
    #[test]
    fn resident_evil_root_archives_and_console_totals() {
        let r = records(&[
            ("eboot.bin", 274707525),
            ("re_chunk_000.pak", 25013524615),
            ("re_chunk_001.pak", 72283211420),
            ("re_chunk_000.pak.patch_001.pak", 6564443278),
            ("dlc1/re_dlc_000.pak", 562),
            ("data/small.bin", 23912),
            ("sce_sys/param.json", 2789),
            ("fakelib/libSceAmpr.sprx", 423350),
            ("cache_ps5/playgo.pgm", 100),
            ("cache_ps5/pgc_1_dummy_file", 1),
            ("sounds/scream/_generated/buss_config.bus", 100),
            ("data/empty.bin", 0),
        ]);
        let p = Policy::build(&r, None, 9, 8).unwrap();
        let packed: Vec<_> = r
            .iter()
            .zip(&p.specs)
            .filter(|(_, s)| s.is_some())
            .map(|((p, n), _)| (p.as_str(), *n))
            .collect();
        assert_eq!(
            packed,
            [
                ("re_chunk_000.pak", 25013524615),
                ("re_chunk_001.pak", 72283211420),
                ("data/small.bin", 23912)
            ]
        );
        assert_eq!(packed.iter().map(|(_, n)| n).sum::<u64>(), 97_296_759_947);
        let e = p.specs[1].unwrap().encoding.unwrap();
        assert!(e.hc && e.dedup);
        assert_eq!(e.level, 9);
        assert_eq!(e.io_page, 65536);
        assert_eq!(e.lanes, 4);
        assert_eq!(e.min_bytes, 64);
        assert_eq!(f64::from_bits(e.min_ratio_bits), 0.01);
        assert_eq!(e.neutral_bytes, 8192);
        assert_eq!(f64::from_bits(e.neutral_ratio_bits), 0.125);
    }
    #[test]
    fn official_fast_and_hc_scales_and_roundtrips() {
        let r = records(&[("re_chunk_000.pak", 65536)]);
        let raw: Vec<u8> = (0..65536).map(|n| (n % 193) as u8).collect();
        for level in 1..=12 {
            let p = Policy::build(&r, None, level, 1).unwrap();
            let e = p.specs[0].unwrap().encoding.unwrap();
            assert_eq!(e.hc, level > 4);
            assert_eq!(e.level, i32::from(level));
            let encoded = compress(&raw, e).unwrap();
            assert_eq!(
                lz4_flex::block::decompress(&encoded, raw.len()).unwrap(),
                raw
            );
        }
        assert!(Policy::build(&r, None, 0, 1).is_err());
        assert!(Policy::build(&r, None, 13, 1).is_err());
    }
    #[test]
    fn bundled_profiles_match_id_name_and_engine() {
        assert_eq!(bundled_profile("PPSA21567", "", &[]).unwrap().0, "astrobot");
        assert_eq!(bundled_profile("", "ASTRO BOT", &[]).unwrap().0, "astrobot");
        assert_eq!(
            bundled_profile("", "", &["toc", "dag", "d/a"]).unwrap().0,
            "insomniac"
        );
        assert_eq!(
            bundled_profile("", "", &["Media/StreamingAssets/x", "Data/data.unity3d"])
                .unwrap()
                .0,
            "unity"
        );
        assert!(bundled_profile("PPSA31246", "RESIDENT EVIL requiem", &[]).is_none());
    }
    #[test]
    fn boot_files_stay_loose_even_with_an_explicit_compress_profile() {
        use std::io::Write;
        let mut f = tempfile::NamedTempFile::new().unwrap();
        f.write_all(b"[pack]\ndefault_action = \"compress\"\n")
            .unwrap();
        let r = records(&[
            ("re_chunk_000.pak", 1000),
            ("nested/a.pak", 1000),
            ("eboot.bin", 1000),
            ("cache_ps5/playgo.pgm", 1000),
            ("fakelib/libSceAmpr.sprx", 1000),
            ("cache_ps5/pgc_0_dummy_file", 1),
        ]);
        let p = Policy::build(&r, Some(f.path()), 9, 1).unwrap();
        assert!(p.specs[0].is_some());
        assert!(p.specs[1..].iter().all(Option::is_none));
    }
}

#[cfg(test)]
mod shared_tests {
    use super::*;
    use crate::writer::{self, PackFile, testkit::Mem};
    use std::sync::atomic::AtomicBool;
    #[test]
    fn shared_chunks_are_deduplicated_and_changed_duplicates_are_rejected() {
        let bytes = vec![b'A'; 3 * 65536];
        let records = vec![("re_chunk_000.pak".to_string(), bytes.len() as u64)];
        let policy = Policy::build(&records, None, 9, 1).unwrap();
        let files = vec![PackFile {
            path: records[0].0.clone(),
            size: records[0].1,
            spec: policy.specs[0],
        }];
        let mut src = Mem::new([(records[0].0.clone(), bytes.clone())]);
        let cancel = AtomicBool::new(false);
        let measured = writer::measure(&mut src, &files, 0, None, 1, &mut |_| {}, &cancel).unwrap();
        assert!(
            measured.report.stored_bytes < 500,
            "three identical blocks use one encoded extent"
        );
        let mut changed = bytes;
        changed[65536] = b'B';
        let mut changed = Mem::new([(records[0].0.clone(), changed)]);
        let err = crate::tree::PackedTree::new(&mut changed, &measured, &files, 1, &cancel)
            .err()
            .expect("changed duplicate must fail");
        assert!(
            err.to_string().contains("source changed in a shared"),
            "{err}"
        );
    }
}
