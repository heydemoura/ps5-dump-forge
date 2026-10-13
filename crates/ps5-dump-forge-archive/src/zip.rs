use super::*;
use flate2::read::DeflateDecoder;
use parts::Parts;
use std::io::{Seek, SeekFrom};
const ENCRYPTED: &str = "Password-protected ZIP files are not supported; re-pack it without a password, or as .7z or .rar.";
fn u16le(b: &[u8], n: usize) -> u16 {
    u16::from_le_bytes(b[n..n + 2].try_into().unwrap())
}
fn u32le(b: &[u8], n: usize) -> u32 {
    u32::from_le_bytes(b[n..n + 4].try_into().unwrap())
}
fn u64le(b: &[u8], n: usize) -> u64 {
    u64::from_le_bytes(b[n..n + 8].try_into().unwrap())
}
struct Record {
    entry: Entry,
    crc: u32,
    packed: u64,
    offset: u64,
    method: u16,
    flags: u16,
}
struct Zip {
    source: Parts,
    records: Vec<Record>,
    volumes: Vec<PathBuf>,
}
fn method(n: u16) -> String {
    match n {
        9 => "Deflate64".into(),
        12 => "BZIP2".into(),
        14 => "LZMA".into(),
        93 => "Zstandard".into(),
        _ => n.to_string(),
    }
}
fn open(paths: &[PathBuf]) -> Result<Zip, ArchiveError> {
    let mut source = Parts::open(paths)?;
    let tail_len = source.len.min(65557) as usize;
    source.seek(SeekFrom::End(-(tail_len as i64)))?;
    let mut tail = vec![0; tail_len];
    source.read_exact(&mut tail)?;
    let end = (0..tail.len().saturating_sub(21))
        .rev()
        .find(|&i| {
            tail[i..i + 4] == [0x50, 0x4b, 5, 6]
                && i + 22 + u16le(&tail, i + 20) as usize == tail.len()
        })
        .ok_or_else(|| {
            parts::missing_next(paths).unwrap_or_else(|| corrupt("ZIP end record is missing."))
        })?;
    let e = &tail[end..];
    let end_pos = source.len - tail_len as u64 + end as u64;
    let disk = u16le(e, 4) as u32;
    let mut cd_disk = u16le(e, 6) as u32;
    let mut count = u16le(e, 10) as u64;
    let mut cd_size = u32le(e, 12) as u64;
    let mut cd_off = u32le(e, 16) as u64;
    let mut volumes = paths.to_vec();
    let mut absolute_end = end_pos;
    if disk != 0 && disk != 65535 {
        if paths.len() == 1 {
            volumes = parts::zip_disks(&paths[0], disk as usize + 1)?;
            source = Parts::open(&volumes)?;
            absolute_end += source.offsets[volumes.len() - 1];
        } else if paths.len() != disk as usize + 1 {
            return Err(corrupt("Invalid split ZIP disk numbering."));
        }
    }
    if disk == 65535
        || cd_disk == 65535
        || count == 65535
        || cd_size == u32::MAX as u64
        || cd_off == u32::MAX as u64
    {
        // Locator is immediately before EOCD, in the last disk for a split archive.
        let mut locator = [0; 20];
        source.seek(SeekFrom::Start(
            absolute_end
                .checked_sub(20)
                .ok_or_else(|| corrupt("Invalid ZIP64 locator."))?,
        ))?;
        source.read_exact(&mut locator)?;
        if u32le(&locator, 0) != 0x07064b50 {
            return Err(corrupt("ZIP64 locator is missing."));
        }
        let disks = u32le(&locator, 16) as usize;
        if disks > 1 && volumes.len() == 1 {
            volumes = parts::zip_disks(&paths[0], disks)?;
            source = Parts::open(&volumes)?;
        }
        let off = source.disk_offset(u32le(&locator, 4), u64le(&locator, 8))?;
        source.seek(SeekFrom::Start(off))?;
        let mut z = [0; 56];
        source.read_exact(&mut z)?;
        if u32le(&z, 0) != 0x06064b50 || u64le(&z, 4) < 44 {
            return Err(corrupt("Invalid ZIP64 end record."));
        }
        cd_disk = u32le(&z, 20);
        count = u64le(&z, 32);
        cd_size = u64le(&z, 40);
        cd_off = u64le(&z, 48);
    }
    let cd = source.disk_offset(cd_disk, cd_off)?;
    let cd_end = cd
        .checked_add(cd_size)
        .filter(|n| *n <= source.len)
        .ok_or_else(|| corrupt("Invalid ZIP directory size."))?;
    if count > cd_size / 46 {
        return Err(corrupt("Invalid ZIP entry count."));
    }
    source.seek(SeekFrom::Start(cd))?;
    let mut records = Vec::new();
    for _ in 0..count {
        let mut h = [0; 46];
        source.read_exact(&mut h)?;
        if u32le(&h, 0) != 0x02014b50 {
            return Err(corrupt("Invalid ZIP central directory."));
        }
        let flags = u16le(&h, 8);
        let method_id = u16le(&h, 10);
        if flags & 1 != 0 {
            return Err(ArchiveError::Unsupported(ENCRYPTED.into()));
        }
        if method_id != 0 && method_id != 8 {
            return Err(ArchiveError::Unsupported(format!(
                "Unsupported ZIP method: {}.",
                method(method_id)
            )));
        }
        let mut name = vec![0; u16le(&h, 28) as usize];
        source.read_exact(&mut name)?;
        let mut extra = vec![0; u16le(&h, 30) as usize];
        source.read_exact(&mut extra)?;
        source.seek(SeekFrom::Current(u16le(&h, 32) as i64))?;
        if source.stream_position()? > cd_end {
            return Err(corrupt("ZIP directory entry exceeds its bounds."));
        }
        let mut size = u32le(&h, 24) as u64;
        let mut packed = u32le(&h, 20) as u64;
        let mut offset = u32le(&h, 42) as u64;
        let mut start_disk = u16le(&h, 34) as u32;
        let mut unicode_name = flags & 0x800 != 0;
        let mut at = 0;
        while at + 4 <= extra.len() {
            let id = u16le(&extra, at);
            let len = u16le(&extra, at + 2) as usize;
            at += 4;
            let field = extra
                .get(at..at + len)
                .ok_or_else(|| corrupt("Invalid ZIP extra field."))?;
            if id == 1 {
                let mut pos = 0;
                for value in [&mut size, &mut packed, &mut offset] {
                    if *value == u32::MAX as u64 {
                        let v = field
                            .get(pos..pos + 8)
                            .ok_or_else(|| corrupt("Incomplete ZIP64 entry."))?;
                        *value = u64le(v, 0);
                        pos += 8;
                    }
                }
                if start_disk == 65535 {
                    start_disk = u32le(
                        field
                            .get(pos..pos + 4)
                            .ok_or_else(|| corrupt("Incomplete ZIP64 disk."))?,
                        0,
                    );
                }
            }
            // Info-ZIP Unicode path, validated against the original name's CRC.
            if id == 0x7075
                && field.len() >= 5
                && field[0] == 1
                && u32le(field, 1) == crc32fast::hash(&name)
            {
                name = field[5..].to_vec();
                unicode_name = true;
            }
            at += len;
        }
        // Some tools (including macOS zip) store UTF-8 without setting bit 11.
        // Preserve valid UTF-8, otherwise decode the legacy ZIP CP437 charset.
        let name = match String::from_utf8(name) {
            Ok(name) => name,
            Err(error) if !unicode_name => {
                const CP437: &str = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";
                let high: Vec<_> = CP437.chars().collect();
                error
                    .into_bytes()
                    .into_iter()
                    .map(|b| {
                        if b < 128 {
                            b as char
                        } else {
                            high[b as usize - 128]
                        }
                    })
                    .collect()
            }
            Err(_) => return Err(corrupt("Invalid UTF-8 ZIP name.")),
        };
        let dir = name.ends_with('/');
        let mode = if h[5] == 3 || h[5] == 19 {
            u32le(&h, 38) >> 16
        } else {
            0
        };
        if u32le(&h, 38) & 0x400 != 0 {
            return Err(ArchiveError::Unsupported(
                "Archive links and special files are not supported.".into(),
            ));
        }
        special(mode, dir)?;
        let entry = Entry {
            path: safe_path(&name, dir)?,
            size,
            dir,
            encrypted: false,
        };
        let offset = source.disk_offset(start_disk, offset)?;
        records.push(Record {
            entry,
            crc: u32le(&h, 16),
            packed,
            offset,
            method: method_id,
            flags,
        });
    }
    Ok(Zip {
        source,
        records,
        volumes,
    })
}
pub(super) fn list(paths: &[PathBuf]) -> Result<Listing, ArchiveError> {
    let z = open(paths)?;
    Ok(Listing {
        format: ArchiveFormat::Zip,
        entries: z.records.into_iter().map(|r| r.entry).collect(),
        volumes: z.volumes,
        archive_bytes: 0,
        solid: false,
        encrypted: false,
    })
}
pub(super) fn walk(
    paths: &[PathBuf],
    sink: &mut dyn Sink,
    cancel: &AtomicBool,
) -> Result<(), ArchiveError> {
    let Zip {
        mut source,
        records,
        ..
    } = open(paths)?;
    for r in records {
        check(cancel)?;
        if sink.done() {
            break;
        }
        if !sink.wants(&r.entry.path) {
            continue;
        }
        let selected = sink.begin(&r.entry)?;
        if !selected {
            continue;
        }
        source.seek(SeekFrom::Start(r.offset))?;
        let mut h = [0; 30];
        source.read_exact(&mut h)?;
        if u32le(&h, 0) != 0x04034b50 || u16le(&h, 6) != r.flags || u16le(&h, 8) != r.method {
            return Err(corrupt("ZIP local header does not match its directory."));
        }
        source.seek(SeekFrom::Current(
            u16le(&h, 26) as i64 + u16le(&h, 28) as i64,
        ))?;
        if source
            .stream_position()?
            .checked_add(r.packed)
            .is_none_or(|n| n > source.len)
        {
            return Err(corrupt("ZIP entry exceeds archive bounds."));
        }
        let mut data = (&mut source).take(r.packed);
        let mut decoder;
        let reader: &mut dyn Read = if r.method == 0 {
            &mut data
        } else {
            decoder = DeflateDecoder::new(&mut data);
            &mut decoder
        };
        let mut crc = crc32fast::Hasher::new();
        let mut buf = [0; 64 * 1024];
        let mut size = 0u64;
        let mut partial = false;
        loop {
            check(cancel)?;
            if sink.enough() {
                partial = true;
                break;
            }
            let n = reader.read(&mut buf)?;
            if n == 0 {
                break;
            }
            size = size
                .checked_add(n as u64)
                .ok_or_else(|| corrupt("ZIP entry is too large."))?;
            if size > r.entry.size {
                return Err(corrupt("ZIP entry exceeds its declared size."));
            }
            crc.update(&buf[..n]);
            sink.chunk(&buf[..n])?;
        }
        if !partial && (size != r.entry.size || crc.finalize() != r.crc) {
            return Err(corrupt("ZIP entry checksum or size does not match."));
        }
        sink.end()?;
    }
    Ok(())
}
