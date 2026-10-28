//! LZ4 asset packs in the AMPRPAK4 layout read by the `ampr_emu` runtime: byte formats, the
//! embedded runtimes, the pack writer and the unpacking reader.

pub mod console;
pub mod format;
pub mod index;
pub mod journal;
pub mod reader;
pub mod rules;
pub mod runtime;
pub mod tree;
pub mod writer;

pub use rules::{
    AutoLoose, Profile, Sample, Selection, always_loose, keep_loose, load_profile, profile_spec,
    select,
};

/// What the rules decide for one packed file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PackSpec {
    /// Console codec/threshold settings; None preserves the upstream Forge codec for old plans.
    pub encoding: Option<console::Encoding>,
    /// log2 of the block size, 14..=20.
    pub block_shift: u8,
    pub store: bool,
    pub hot: bool,
    pub random: bool,
}

impl PackSpec {
    pub(crate) fn for_block(mut self, size: u64, block: u64) -> Self {
        if let Some(e) = &mut self.encoding
            && e.striped
            && e.lanes > 1
            && size >= e.stripe_threshold
        {
            e.lane =
                (u64::from(e.lane) + block / u64::from(e.stripe_blocks.max(1))) as u32 % e.lanes;
        }
        self
    }
}

/// The optional AMPRCFG1 runtime profile (`ampr_assets.index.runtime`), from a TOML `[runtime]`
/// table. `rules` parses and validates it; `writer` encodes it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RuntimeProfile {
    /// Planning-only: compute the console cache budget after the manifest size is exact.
    pub auto_budget_index_bytes: Option<u64>,
    pub decoded_cache_bytes: u64,
    pub physical_cache_bytes: u64,
    pub workers: u32,
    pub latency_reserve_workers: u32,
}

impl RuntimeProfile {
    pub fn resolved(mut self, manifest_bytes: u64) -> Self {
        if let Some(index) = self.auto_budget_index_bytes.take() {
            let fixed = (32 * 2 + u64::from(self.workers) + 32 + 16) << 20;
            let avail = (384u64 << 20).saturating_sub(fixed + manifest_bytes + index);
            let physical = (avail / 4).min(64 << 20);
            let decoded = (avail - physical).min(256 << 20);
            self.physical_cache_bytes = physical / 16384 * 16384;
            self.decoded_cache_bytes = decoded / 16384 * 16384;
        }
        self
    }
}

pub const MANIFEST: &str = "ampr_assets.index";
pub const CRC_SIDECAR: &str = "ampr_assets.index.crc";
pub const PROFILE: &str = "ampr_assets.index.runtime";
pub const INDEX: &str = "ampr_emu.index";
pub const RUNTIME: &str = "fakelib/libSceAmpr.sprx";
pub const JOURNAL: &str = "ampr_commands.bin";
pub const LOGS: [&str; 2] = ["ampr_emu.log", "apr_emu.log"];

/// Volume file name for pack `n`: `ampr_assets-000.pak` (three digits at least).
pub fn volume_name(n: u32) -> String {
    format!("ampr_assets-{n:03}.pak")
}
