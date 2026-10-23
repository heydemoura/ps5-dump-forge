//! srvsvc NetShareEnumAll over the `\srvsvc` pipe (DCE/RPC, NDR): the server's share names.
//! ponytail: a reply in one fragment only (a few hundred shares); no RPC auth.

use crate::ntlm::utf16;
use std::io;

const SRVSVC: [u8; 16] = [
    0xc8, 0x4f, 0x32, 0x4b, 0x70, 0x16, 0xd3, 0x01, 0x12, 0x78, 0x5a, 0x47, 0xbf, 0x6e, 0xe1, 0x88,
];
const NDR: [u8; 16] = [
    0x04, 0x5d, 0x88, 0x8a, 0xeb, 0x1c, 0xc9, 0x11, 0x9f, 0xe8, 0x08, 0x00, 0x2b, 0x10, 0x48, 0x60,
];

fn bad() -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, "SMB: a bad share list reply")
}

fn pdu(ptype: u8, call: u32, body: &[u8]) -> Vec<u8> {
    let mut m = vec![5, 0, ptype, 3, 0x10, 0, 0, 0];
    m.extend_from_slice(&((16 + body.len()) as u16).to_le_bytes());
    m.extend_from_slice(&0u16.to_le_bytes());
    m.extend_from_slice(&call.to_le_bytes());
    m.extend_from_slice(body);
    m
}

/// An NDR conformant varying string (with its NUL), padded to 4 bytes.
fn ndr_string(m: &mut Vec<u8>, s: &str) {
    let mut w = utf16(s);
    w.extend_from_slice(&[0, 0]);
    let n = (w.len() / 2) as u32;
    for v in [n, 0, n] {
        m.extend_from_slice(&v.to_le_bytes());
    }
    m.extend_from_slice(&w);
    while !m.len().is_multiple_of(4) {
        m.push(0);
    }
}

/// Binds to srvsvc and calls NetShareEnumAll (level 1) through `call` (one pipe transceive per
/// PDU); the disk shares' names.
pub(crate) fn share_enum(
    host: &str,
    mut call: impl FnMut(&[u8]) -> io::Result<Vec<u8>>,
) -> io::Result<Vec<String>> {
    let mut bind = Vec::new();
    bind.extend_from_slice(&4280u16.to_le_bytes());
    bind.extend_from_slice(&4280u16.to_le_bytes());
    bind.extend_from_slice(&0u32.to_le_bytes());
    bind.extend_from_slice(&[1, 0, 0, 0, 0, 0, 1, 0]); // one context, id 0, one transfer syntax
    bind.extend_from_slice(&SRVSVC);
    bind.extend_from_slice(&3u32.to_le_bytes());
    bind.extend_from_slice(&NDR);
    bind.extend_from_slice(&2u32.to_le_bytes());
    let ack = call(&pdu(11, 1, &bind))?;
    if ack.get(2) != Some(&12) {
        return Err(bad());
    }
    let mut stub = Vec::new();
    stub.extend_from_slice(&0x0002_0000u32.to_le_bytes());
    ndr_string(&mut stub, &format!(r"\\{host}"));
    for v in [1u32, 1, 0x0002_0004, 0, 0, u32::MAX, 0x0002_0008, 0] {
        stub.extend_from_slice(&v.to_le_bytes());
    }
    let mut req = Vec::new();
    req.extend_from_slice(&(stub.len() as u32).to_le_bytes());
    req.extend_from_slice(&0u16.to_le_bytes());
    req.extend_from_slice(&15u16.to_le_bytes()); // NetrShareEnum
    req.extend_from_slice(&stub);
    let resp = call(&pdu(0, 2, &req))?;
    if resp.get(2) != Some(&2) || resp.len() < 24 {
        return Err(bad());
    }
    parse(&resp[24..])
}

fn parse(s: &[u8]) -> io::Result<Vec<String>> {
    let u32at = |at: usize| -> io::Result<u32> {
        Ok(u32::from_le_bytes(
            s.get(at..at + 4).ok_or_else(bad)?.try_into().unwrap(),
        ))
    };
    let count = u32at(12)? as usize;
    if count == 0 || u32at(16)? == 0 {
        return Ok(Vec::new());
    }
    let mut at = 24;
    let mut entries = Vec::with_capacity(count.min(4096));
    for _ in 0..count {
        entries.push((u32at(at)? != 0, u32at(at + 4)?, u32at(at + 8)? != 0));
        at += 12;
    }
    let string = |at: &mut usize| -> io::Result<String> {
        let n = u32at(*at + 8)? as usize;
        let raw = s.get(*at + 12..*at + 12 + n * 2).ok_or_else(bad)?;
        *at = (*at + 12 + n * 2).next_multiple_of(4);
        let w: Vec<u16> = raw
            .chunks(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        Ok(String::from_utf16_lossy(&w)
            .trim_end_matches('\0')
            .to_string())
    };
    let mut names = Vec::new();
    for (has_name, kind, has_remark) in entries {
        let name = if has_name {
            string(&mut at)?
        } else {
            String::new()
        };
        if has_remark {
            string(&mut at)?;
        }
        if kind & 0x0FFF_FFFF == 0 && !name.is_empty() {
            names.push(name); // a disk share
        }
    }
    Ok(names)
}
