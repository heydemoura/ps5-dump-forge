use super::*;
use std::io::{Seek, SeekFrom};

fn sibling(path: &Path, name: &str) -> Result<PathBuf, ArchiveError> {
    for item in fs::read_dir(folder(path))? {
        let item = item?;
        if item
            .file_name()
            .to_str()
            .is_some_and(|n| n.eq_ignore_ascii_case(name))
        {
            return Ok(item.path());
        }
    }
    Err(ArchiveError::MissingPart(name.into()))
}
fn digits(s: &str) -> Option<usize> {
    if s.is_empty() || !s.bytes().all(|b| b.is_ascii_digit()) {
        None
    } else {
        s.parse().ok()
    }
}
pub(super) fn missing_next(paths: &[PathBuf]) -> Option<ArchiveError> {
    let (base, ext) = paths.last()?.file_name()?.to_str()?.rsplit_once('.')?;
    let n = digits(ext)?.checked_add(1)?;
    Some(ArchiveError::MissingPart(format!(
        "{base}.{n:0width$}",
        width = ext.len()
    )))
}
/// The folder `path` is in; `.` for a bare name (whose `parent()` is empty).
fn folder(path: &Path) -> &Path {
    path.parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."))
}
/// The first part's name when `name` is, by its name alone, a later part of a set.
pub(super) fn first_of(name: &str, format: ArchiveFormat) -> Option<String> {
    let lower = name.to_ascii_lowercase();
    let (base, ext) = name.rsplit_once('.').unwrap_or((name, ""));
    if format != ArchiveFormat::Rar
        && let Some(n) = digits(ext)
    {
        return (n != 1).then(|| format!("{base}.{:0width$}", 1, width = ext.len()));
    }
    if format == ArchiveFormat::Rar {
        if ext.len() == 3
            && (b'r'..=b'z').contains(&ext.as_bytes()[0].to_ascii_lowercase())
            && digits(&ext[1..]).is_some()
        {
            return Some(format!("{base}.rar"));
        }
        if let Some((stem, number)) = lower
            .strip_suffix(".rar")
            .and_then(|s| s.rsplit_once(".part"))
            && let Some(n) = digits(number)
            && n != 1
        {
            return Some(format!(
                "{}{:0width$}.rar",
                &name[..stem.len() + 5],
                1,
                width = number.len()
            ));
        }
    }
    if format == ArchiveFormat::Zip
        && ext.to_ascii_lowercase().starts_with('z')
        && digits(&ext[1..]).is_some()
    {
        return Some(format!("{base}.zip"));
    }
    None
}
pub(super) fn discover(path: &Path, format: ArchiveFormat) -> Result<Vec<PathBuf>, ArchiveError> {
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| corrupt("Archive name is not UTF-8."))?;
    if let Some(first) = first_of(name, format) {
        return Err(ArchiveError::NotFirstPart(first));
    }
    let (base, ext) = name.rsplit_once('.').unwrap_or((name, ""));
    if format != ArchiveFormat::Rar && digits(ext).is_some() {
        let mut last = 1;
        for item in fs::read_dir(folder(path))? {
            let item = item?;
            if let Some((b, e)) = item.file_name().to_str().and_then(|s| s.rsplit_once('.'))
                && b.eq_ignore_ascii_case(base)
                && e.len() == ext.len()
                && let Some(n) = digits(e)
            {
                last = last.max(n);
            }
        }
        if last > 100_000 {
            return Err(corrupt("Too many archive volumes."));
        }
        return (1..=last)
            .map(|n| sibling(path, &format!("{base}.{n:0width$}", width = ext.len())))
            .collect();
    }
    Ok(vec![path.to_owned()])
}
pub(super) fn zip_disks(path: &Path, count: usize) -> Result<Vec<PathBuf>, ArchiveError> {
    if count > 100_000 {
        return Err(corrupt("Too many ZIP disks."));
    }
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| corrupt("Archive name is not UTF-8."))?;
    let mut result = (1..count)
        .map(|n| sibling(path, &format!("{stem}.z{n:02}")))
        .collect::<Result<Vec<_>, _>>()?;
    result.push(path.to_owned());
    Ok(result)
}

/// Seekable concatenation; keeps files open, but reads into the caller's buffer only.
pub(super) struct Parts {
    files: Vec<File>,
    pub offsets: Vec<u64>,
    pub len: u64,
    pos: u64,
}
impl Parts {
    pub fn open(paths: &[PathBuf]) -> Result<Self, ArchiveError> {
        let mut files = Vec::new();
        let mut offsets = Vec::new();
        let mut len = 0u64;
        for p in paths {
            let f = File::open(p)?;
            offsets.push(len);
            len = len
                .checked_add(f.metadata()?.len())
                .ok_or_else(|| corrupt("Archive is too large."))?;
            files.push(f);
        }
        Ok(Self {
            files,
            offsets,
            len,
            pos: 0,
        })
    }
    pub fn disk_offset(&self, disk: u32, offset: u64) -> Result<u64, ArchiveError> {
        self.offsets
            .get(disk as usize)
            .and_then(|n| n.checked_add(offset))
            .filter(|n| *n <= self.len)
            .ok_or_else(|| corrupt("Invalid archive disk offset."))
    }
}
impl Read for Parts {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        if self.pos >= self.len || buf.is_empty() {
            return Ok(0);
        }
        let disk = self.offsets.partition_point(|&n| n <= self.pos) - 1;
        let end = self.offsets.get(disk + 1).copied().unwrap_or(self.len);
        let count = buf
            .len()
            .min((end - self.pos).min(usize::MAX as u64) as usize);
        self.files[disk].seek(SeekFrom::Start(self.pos - self.offsets[disk]))?;
        let n = self.files[disk].read(&mut buf[..count])?;
        if n == 0 {
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                "Archive volume was truncated.",
            ));
        }
        self.pos += n as u64;
        Ok(n)
    }
}
impl Seek for Parts {
    fn seek(&mut self, from: SeekFrom) -> io::Result<u64> {
        let pos = match from {
            SeekFrom::Start(n) => i128::from(n),
            SeekFrom::End(n) => i128::from(self.len) + i128::from(n),
            SeekFrom::Current(n) => i128::from(self.pos) + i128::from(n),
        };
        self.pos = u64::try_from(pos)
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "Invalid archive seek."))?;
        Ok(self.pos)
    }
}
