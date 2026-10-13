//! A game folder as a packed game: what an image writer is given in place of the folder.
//!
//! [`prepare`] packs the folder's files into volumes in a spool folder and returns an
//! [`Overlay`]: the folder minus every packed original, plus a regenerated `ampr_emu.index`
//! (listing the original files, which is what `ampr_emu` resolves), the manifest and its
//! sidecars, and the volumes. A folder emptied by packing is kept as an empty folder.

use std::collections::{BTreeSet, HashMap};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use super::config::{pack_output_glob, Config};
use super::{glob, pack, runtime_support, Control, Output};
use crate::ampr_index;
use crate::source::{SourceFile, SourceTree};
use crate::{format_err, Error, Result};

/// Where `ampr_emu` lives in a backported game.
pub const RUNTIME_MODULE: &str = "fakelib/libSceAmpr.sprx";

/// Whether a libSceAmpr title can be packed, as the Convert screen shows it.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct Readiness {
    /// The version the game's `ampr_emu` reports, when its module says.
    pub runtime_version: Option<String>,
    /// Why packing is refused; `None` when it can go ahead.
    pub refusal: Option<String>,
    /// `ok`; `runtime` (the game's ampr_emu is missing or too old: installing
    /// [`RUNTIME_VERSION`] into the image makes packs possible); `no_ampr` (the game does not
    /// read through AMPR, so nothing could serve packs: .ffpfsc is its compression).
    pub kind: &'static str,
}

/// The ampr_emu release the engine can put into an image (`fakelib/libSceAmpr.sprx`) when the
/// game's own is missing or predates asset packs; the game's own copy is kept beside it as
/// `libSceAmpr.sprx.orig`. drakmor/ampr_emu, GPL-3.0; fetched on first use, never bundled.
pub const RUNTIME_VERSION: &str = "0.4.2.1";
pub const RUNTIME_URL: &str =
    "https://github.com/drakmor/ampr_emu/releases/download/0.4.2.1/libSceAmpr.sprx";
pub const RUNTIME_SHA256: &str = "69e6c4d5e4f5fb83c9e01815db5861c4c75734acbf4595cafa50d4c218116d1a";
/// Where the game's own module goes when the engine installs the release one.
pub const RUNTIME_MODULE_ORIG: &str = "fakelib/libSceAmpr.sprx.orig";

/// `Some(no_ampr)` when the title does not import libSceAmpr: nothing but `ampr_emu` reads
/// asset packs. Otherwise whether the `libSceAmpr.sprx` the game ships serves them — an
/// older `ampr_emu` (0.3) would find every packed file missing. The module is recognised by
/// its own strings (see [`runtime_support`]).
pub fn readiness(tree: &mut dyn SourceTree) -> Option<Readiness> {
    if !crate::source::imports_ampr(tree, "eboot.bin") {
        return Some(Readiness {
            runtime_version: None,
            refusal: Some(
                "this game does not read its files through AMPR, so nothing could serve \
                 asset packs; compress it into a .ffpfsc instead"
                    .into(),
            ),
            kind: "no_ampr",
        });
    }
    let Some(module) = tree
        .files()
        .iter()
        .find(|f| f.path.eq_ignore_ascii_case(RUNTIME_MODULE))
        .map(|f| f.path.clone())
    else {
        return Some(Readiness {
            runtime_version: None,
            refusal: Some(format!(
                "LZ4 asset packs need ampr_emu 0.4 or later with pack support in the game's \
                 {RUNTIME_MODULE}, and the folder has none"
            )),
            kind: "runtime",
        });
    };
    let support = match tree.read(&module) {
        Ok(bytes) => runtime_support(&bytes),
        Err(e) => {
            return Some(Readiness {
                runtime_version: None,
                refusal: Some(format!("{module} could not be read: {e}")),
                kind: "runtime",
            })
        }
    };
    let refusal = (!support.packs).then(|| {
        format!(
            "the game's {module} ({}) does not serve asset packs; LZ4 packs need ampr_emu 0.4 \
             or later with pack support",
            support
                .version
                .as_deref()
                .map_or("unknown version".to_string(), |v| format!("ampr_emu {v}"))
        )
    });
    Some(Readiness {
        kind: if refusal.is_some() { "runtime" } else { "ok" },
        runtime_version: support.version,
        refusal,
    })
}

/// A game with the release ampr_emu in place of its own `fakelib/libSceAmpr.sprx` (kept as
/// `libSceAmpr.sprx.orig`), or added when it had none. `bytes` must serve packs.
pub struct RuntimeInstalled {
    inner: Box<dyn SourceTree>,
    files: Vec<crate::source::SourceFile>,
    runtime: Vec<u8>,
    orig_path: Option<String>,
}

impl RuntimeInstalled {
    pub fn new(inner: Box<dyn SourceTree>, runtime: Vec<u8>) -> crate::Result<Self> {
        let support = runtime_support(&runtime);
        if !support.packs {
            return Err(crate::Error::Format(
                "the ampr_emu to install does not serve asset packs".into(),
            ));
        }
        let orig_path = inner
            .files()
            .iter()
            .find(|f| f.path.eq_ignore_ascii_case(RUNTIME_MODULE))
            .map(|f| f.path.clone());
        let mut files: Vec<crate::source::SourceFile> = inner
            .files()
            .iter()
            .filter(|f| {
                !f.path.eq_ignore_ascii_case(RUNTIME_MODULE)
                    && !f.path.eq_ignore_ascii_case(RUNTIME_MODULE_ORIG)
            })
            .cloned()
            .collect();
        if let Some(orig) = &orig_path {
            let size = inner
                .files()
                .iter()
                .find(|f| &f.path == orig)
                .map_or(0, |f| f.size);
            files.push(crate::source::SourceFile {
                path: RUNTIME_MODULE_ORIG.to_string(),
                size,
            });
        }
        files.push(crate::source::SourceFile {
            path: RUNTIME_MODULE.to_string(),
            size: runtime.len() as u64,
        });
        files.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(Self {
            inner,
            files,
            runtime,
            orig_path,
        })
    }

    fn resolve(&self, path: &str) -> Option<&str> {
        if path.eq_ignore_ascii_case(RUNTIME_MODULE_ORIG) {
            return self.orig_path.as_deref();
        }
        None
    }
}

impl SourceTree for RuntimeInstalled {
    fn files(&self) -> &[crate::source::SourceFile] {
        &self.files
    }
    fn empty_dirs(&self) -> &[String] {
        self.inner.empty_dirs()
    }
    fn read(&mut self, path: &str) -> crate::Result<Vec<u8>> {
        if path.eq_ignore_ascii_case(RUNTIME_MODULE) {
            return Ok(self.runtime.clone());
        }
        if let Some(orig) = self.resolve(path).map(str::to_string) {
            return self.inner.read(&orig);
        }
        self.inner.read(path)
    }
    fn read_range(&mut self, path: &str, offset: u64, len: usize) -> crate::Result<Vec<u8>> {
        if path.eq_ignore_ascii_case(RUNTIME_MODULE) {
            let start = (offset as usize).min(self.runtime.len());
            let end = start.saturating_add(len).min(self.runtime.len());
            return Ok(self.runtime[start..end].to_vec());
        }
        if let Some(orig) = self.resolve(path).map(str::to_string) {
            return self.inner.read_range(&orig, offset, len);
        }
        self.inner.read_range(path, offset, len)
    }
    fn describe(&self) -> String {
        format!(
            "{} (ampr_emu {RUNTIME_VERSION} installed)",
            self.inner.describe()
        )
    }
}

/// Why `tree` cannot be packed for `ampr_emu`, or `None` when it can.
pub fn refusal(tree: &mut dyn SourceTree) -> Option<String> {
    match readiness(tree) {
        None => Some(
            "LZ4 asset packs are read by ampr_emu, and this game's eboot.bin does not import \
             libSceAmpr"
                .into(),
        ),
        Some(r) => r.refusal,
    }
}

/// Files an earlier AMPR build or run left, which a fresh index and pack set replace.
fn generated(path: &str, config: &Config, pack_glob: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    let index = config.index_name.to_ascii_lowercase();
    lower == ampr_index::NAME
        || lower == "ampr_commands.bin"
        || lower == "apr_emu.log"
        || lower == index
        || lower == format!("{index}.crc")
        || lower == format!("{index}.runtime")
        || glob::matches_any(path, &[pack_glob])
}

/// What the image holds instead of the folder.
pub struct Overlay<'a> {
    source: &'a mut dyn SourceTree,
    files: Vec<SourceFile>,
    empty_dirs: Vec<String>,
    memory: HashMap<String, Vec<u8>>,
    volumes: HashMap<String, PathBuf>,
    open: Option<(String, std::fs::File)>,
    label: String,
}

impl SourceTree for Overlay<'_> {
    fn files(&self) -> &[SourceFile] {
        &self.files
    }

    fn read(&mut self, path: &str) -> Result<Vec<u8>> {
        let size = self
            .files
            .iter()
            .find(|f| f.path == path)
            .map(|f| f.size)
            .ok_or_else(|| Error::Format(format!("{path} is not in the packed image")))?;
        self.read_range(path, 0, size as usize)
    }

    fn read_range(&mut self, path: &str, offset: u64, len: usize) -> Result<Vec<u8>> {
        if let Some(bytes) = self.memory.get(path) {
            let at = (offset as usize).min(bytes.len());
            return Ok(bytes[at..(at + len).min(bytes.len())].to_vec());
        }
        if let Some(file) = self.volumes.get(path) {
            if self.open.as_ref().is_none_or(|(p, _)| p != path) {
                self.open = Some((path.to_string(), std::fs::File::open(file)?));
            }
            let (_, f) = self.open.as_mut().unwrap();
            f.seek(SeekFrom::Start(offset))?;
            let mut buf = Vec::with_capacity(len);
            f.by_ref().take(len as u64).read_to_end(&mut buf)?;
            return Ok(buf);
        }
        self.source.read_range(path, offset, len)
    }

    fn empty_dirs(&self) -> &[String] {
        &self.empty_dirs
    }

    fn describe(&self) -> String {
        self.label.clone()
    }
}

/// Pack `source` by `config` into `spool` (which must not exist yet) and return the tree the
/// image is written from, with the pack report. Every file is listed in the regenerated
/// `ampr_emu.index` at `mtime`.
pub fn prepare<'a>(
    source: &'a mut dyn SourceTree,
    config: &Config,
    spool: &Path,
    mtime: i64,
    control: &mut Control,
) -> Result<(Overlay<'a>, Output)> {
    let pack_glob = pack_output_glob(&config.pack_pattern)?;
    if source.files().iter().any(|f| {
        f.path.eq_ignore_ascii_case(&config.index_name) || glob::matches_any(&f.path, &[&pack_glob])
    }) {
        return format_err(
            "the folder already carries AMPR asset packs; its packed files are not there to \
             pack again",
        );
    }
    let logical: Vec<ampr_index::Entry> = source
        .files()
        .iter()
        .filter(|f| !generated(&f.path, config, &pack_glob))
        .map(|f| ampr_index::Entry {
            path: f.path.clone(),
            size: f.size,
            mtime,
        })
        .collect();
    let index = ampr_index::build_entries(&logical).map_err(Error::Format)?;
    let entries = ampr_index::parse(&index)
        .ok_or_else(|| Error::Format("the generated index does not read back".into()))?;
    std::fs::create_dir(spool).map_err(|e| Error::Format(format!("{}: {e}", spool.display())))?;
    let output = match pack::build(&entries, source, config, spool, control) {
        Ok(o) => o,
        Err(e) => {
            let _ = std::fs::remove_dir_all(spool);
            return Err(e);
        }
    };

    let sizes: HashMap<&str, u64> = source
        .files()
        .iter()
        .map(|f| (f.path.as_str(), f.size))
        .collect();
    let mut files: Vec<SourceFile> = output
        .loose
        .iter()
        .map(|p| SourceFile {
            path: p.clone(),
            size: sizes[p.as_str()],
        })
        .collect();
    let mut memory = HashMap::new();
    files.push(SourceFile {
        path: ampr_index::NAME.to_string(),
        size: index.len() as u64,
    });
    memory.insert(ampr_index::NAME.to_string(), index);
    for (name, bytes) in output.small_files() {
        files.push(SourceFile {
            path: name.clone(),
            size: bytes.len() as u64,
        });
        memory.insert(name, bytes.to_vec());
    }
    let mut volumes = HashMap::new();
    for (name, path) in &output.volumes {
        files.push(SourceFile {
            path: name.clone(),
            size: std::fs::metadata(path)?.len(),
        });
        volumes.insert(name.clone(), path.clone());
    }

    // Folders packing emptied stay, as empty folders: only the innermost need naming.
    let mut kept: BTreeSet<String> = BTreeSet::new();
    let source_empty: Vec<String> = source
        .empty_dirs()
        .iter()
        .map(|d| d.trim_matches('/').to_string())
        .collect();
    for d in &source_empty {
        kept.insert(d.clone());
    }
    for path in files
        .iter()
        .map(|f| f.path.as_str())
        .chain(source_empty.iter().map(|d| d.as_str()))
    {
        let mut p = path;
        while let Some((dir, _)) = p.rsplit_once('/') {
            kept.insert(dir.to_string());
            p = dir;
        }
    }
    let mut emptied: BTreeSet<String> = BTreeSet::new();
    for p in &output.packed {
        let mut p = p.as_str();
        while let Some((dir, _)) = p.rsplit_once('/') {
            if !kept.contains(dir) {
                emptied.insert(dir.to_string());
            }
            p = dir;
        }
    }
    let mut empty_dirs = source_empty;
    for d in &emptied {
        let prefix = format!("{d}/");
        if !emptied.iter().any(|o| o.starts_with(&prefix)) {
            empty_dirs.push(d.clone());
        }
    }
    let label = format!("{} with LZ4 asset packs", source.describe());
    Ok((
        Overlay {
            source,
            files,
            empty_dirs,
            memory,
            volumes,
            open: None,
            label,
        },
        output,
    ))
}
