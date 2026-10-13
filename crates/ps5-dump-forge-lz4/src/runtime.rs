//! The two embedded `ampr_emu` runtimes (unmodified upstream 0.4.2.1, see `vendor/ampr_emu/README.md`)
//! and recognition of a runtime found in a game folder, by SHA-256 of the whole file.

use sha2::{Digest, Sha256};

/// The release runtime (upstream's `test-pack` build): reads packs, writes no trace.
pub static RELEASE: &[u8] = include_bytes!("../../../vendor/ampr_emu/libSceAmpr.sprx");
/// The tracing runtime (upstream's `test-debug-pack` build): also writes the command journal.
pub static TRACE: &[u8] = include_bytes!("../../../vendor/ampr_emu/libSceAmpr-trace.sprx");

pub const VERSION: &str = "0.4.2.1";
/// Logged on every trace and pack job.
pub const WARNING: &str =
    "ampr_emu 0.4.2.1 is an upstream test build; known issue: some games crash when saving";

const RELEASE_SHA256: &str = "69e6c4d5e4f5fb83c9e01815db5861c4c75734acbf4595cafa50d4c218116d1a";
const TRACE_SHA256: &str = "b44a986f2fa9903e74a34cbbd4681e899cd99196613652cd073ed11f2ca947c2";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeKind {
    ForgeRelease,
    ForgeTrace,
    /// Some other runtime (a different version or build).
    Other,
    /// No runtime (the file is absent or empty).
    None,
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

/// Which runtime `bytes` (the whole `libSceAmpr.sprx`) is.
pub fn classify(bytes: &[u8]) -> RuntimeKind {
    if bytes.is_empty() {
        return RuntimeKind::None;
    }
    match sha256_hex(bytes).as_str() {
        RELEASE_SHA256 => RuntimeKind::ForgeRelease,
        TRACE_SHA256 => RuntimeKind::ForgeTrace,
        _ => RuntimeKind::Other,
    }
}

/// The ampr_emu version a runtime names itself with (`AMPR_EMU_VERSION`, "0.4.2.1 (c) Drakmor",
/// in its log line): the dotted number before the first " (c) Drakmor". `None` for a runtime
/// that names no version that way (another author's, or one built differently).
pub fn version_of(bytes: &[u8]) -> Option<String> {
    const MARK: &[u8] = b" (c) Drakmor";
    // Every marker must name the same, well-formed version; anything else is `None`.
    let mut found: Option<String> = None;
    let marks = bytes
        .windows(MARK.len())
        .enumerate()
        .filter(|(_, w)| *w == MARK);
    for (at, _) in marks {
        let start = bytes[..at]
            .iter()
            .rposition(|b| !(b.is_ascii_digit() || *b == b'.'))
            .map_or(0, |i| i + 1);
        let v = std::str::from_utf8(&bytes[start..at]).ok()?;
        let numbers = v.split('.').all(|p| p.parse::<u64>().is_ok());
        if !numbers || !v.contains('.') || found.as_deref().is_some_and(|f| f != v) {
            return None;
        }
        found = Some(v.to_owned());
    }
    found
}

/// Whether a runtime holds the pack format's magics (`AMPRPAK4` manifest, `AMPRDAT3` volumes),
/// as both builds Forge ships do; upstream's no-pack build reads no packs.
// ponytail: a name check, not proof the runtime reads this exact layout; the version decides
// the rest.
pub fn reads_packs(bytes: &[u8]) -> bool {
    let has = |m: &[u8]| bytes.windows(m.len()).any(|w| w == m);
    has(b"AMPRPAK4") && has(b"AMPRDAT3")
}

/// Whether `version` (dotted numbers) is [`VERSION`] or newer: such a runtime is kept as it is.
pub fn not_older(version: &str) -> bool {
    let parts = |v: &str| -> Vec<u64> { v.split('.').map(|p| p.parse().unwrap_or(0)).collect() };
    let (mut a, mut b) = (parts(version), parts(VERSION));
    let n = a.len().max(b.len());
    a.resize(n, 0);
    b.resize(n, 0);
    a >= b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versions() {
        assert_eq!(version_of(RELEASE).as_deref(), Some(VERSION));
        assert_eq!(version_of(TRACE).as_deref(), Some(VERSION));
        assert_eq!(version_of(b"x\x000.5 (c) Drakmor").as_deref(), Some("0.5"));
        assert_eq!(version_of(b"no version here"), None);
        assert_eq!(version_of(b"0.5 (c) Drakmor..0.3.9 (c) Drakmor"), None);
        assert_eq!(version_of(b"0.18446744073709551616 (c) Drakmor"), None);
        assert_eq!(version_of(b"x0.5. (c) Drakmor"), None);
        assert_eq!(version_of(b"0.4.2.1 (c) Drakmor 0.5.. (c) Drakmor"), None);
        assert!(reads_packs(RELEASE) && reads_packs(TRACE) && !reads_packs(b"AMPRPAK4 only"));
        assert!(not_older("0.4.2.1") && not_older("0.4.3") && not_older("0.5") && not_older("1.0"));
        assert!(!not_older("0.4.2") && !not_older("0.4.1.9") && !not_older("0.3.9.9"));
    }

    #[test]
    fn pinned_sizes_and_hashes() {
        assert_eq!(RELEASE.len(), 423350);
        assert_eq!(TRACE.len(), 633094);
        assert_eq!(sha256_hex(RELEASE), RELEASE_SHA256);
        assert_eq!(sha256_hex(TRACE), TRACE_SHA256);
        assert_eq!(RELEASE_SHA256.len(), 64);
        assert_eq!(TRACE_SHA256.len(), 64);
    }

    #[test]
    fn classifies() {
        assert_eq!(classify(RELEASE), RuntimeKind::ForgeRelease);
        assert_eq!(classify(TRACE), RuntimeKind::ForgeTrace);
        assert_eq!(classify(&RELEASE[1..]), RuntimeKind::Other);
        assert_eq!(classify(b"x"), RuntimeKind::Other);
        assert_eq!(classify(b""), RuntimeKind::None);
    }
}
