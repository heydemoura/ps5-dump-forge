//! NTLMv2 (MS-NLMP), raw NTLMSSP tokens (no SPNEGO): what an SMB2 session setup needs.
//! No key exchange, so the session key is the NTLMv2 session base key.
//! ponytail: no MIC and no channel bindings; servers that insist on them refuse the login.

use hmac::{Hmac, KeyInit, Mac};
use md5::Md5;
use std::io;

const SIG: &[u8; 8] = b"NTLMSSP\0";
const FLAGS: u32 = 0x0000_0001 // UNICODE
    | 0x0000_0004 // REQUEST_TARGET
    | 0x0000_0010 // SIGN
    | 0x0000_0200 // NTLM
    | 0x0000_8000 // ALWAYS_SIGN
    | 0x0008_0000 // EXTENDED_SESSIONSECURITY
    | 0x0080_0000 // TARGET_INFO
    | 0x2000_0000 // 128
    | 0x8000_0000; // 56
const ANONYMOUS: u32 = 0x0000_0800;

pub(crate) fn negotiate() -> Vec<u8> {
    let mut m = Vec::with_capacity(32);
    m.extend_from_slice(SIG);
    m.extend_from_slice(&1u32.to_le_bytes());
    m.extend_from_slice(&FLAGS.to_le_bytes());
    m.extend_from_slice(&[0; 16]); // domain and workstation: empty
    m
}

/// The AUTHENTICATE token for `challenge` and the session key (`None` for an anonymous login,
/// an empty user).
pub(crate) fn authenticate(
    challenge: &[u8],
    user: &str,
    pass: &str,
) -> io::Result<(Vec<u8>, Option<[u8; 16]>)> {
    let bad = || io::Error::new(io::ErrorKind::InvalidData, "bad NTLM challenge");
    if challenge.len() < 32 || &challenge[..8] != SIG || u32le(challenge, 8) != 2 {
        return Err(bad());
    }
    let server = &challenge[24..32];
    let info = field(challenge, 40).ok_or_else(bad)?;
    let (domain, user) = match user.split_once(['\\', '/']) {
        Some((d, u)) => (d, u),
        None => ("", user),
    };
    if user.is_empty() {
        let token = message(FLAGS | ANONYMOUS, &[0], &[], "", "");
        return Ok((token, None));
    }
    // MsvAvTimestamp when the server sent one, else now (FILETIME: 100 ns since 1601).
    let time = av(info, 7)
        .filter(|v| v.len() == 8)
        .map(|v| u64::from_le_bytes(v.try_into().unwrap()))
        .unwrap_or_else(filetime_now);
    let mut client = [0u8; 8];
    getrandom::fill(&mut client).map_err(|e| io::Error::other(e.to_string()))?;
    let nt_hash = md4(&utf16(pass));
    let owf = hmac_md5(&nt_hash, &[&utf16(&user.to_uppercase()), &utf16(domain)]);
    let mut blob = vec![1, 1, 0, 0, 0, 0, 0, 0];
    blob.extend_from_slice(&time.to_le_bytes());
    blob.extend_from_slice(&client);
    blob.extend_from_slice(&[0; 4]);
    blob.extend_from_slice(info);
    blob.extend_from_slice(&[0; 4]);
    let proof = hmac_md5(&owf, &[server, &blob]);
    let key = hmac_md5(&owf, &[&proof]);
    let mut nt = proof.to_vec();
    nt.extend_from_slice(&blob);
    Ok((message(FLAGS, &[0; 24], &nt, domain, user), Some(key)))
}

/// AUTHENTICATE_MESSAGE: header, six fields (LM, NT, domain, user, workstation, session key),
/// flags, then the payload.
fn message(flags: u32, lm: &[u8], nt: &[u8], domain: &str, user: &str) -> Vec<u8> {
    let parts = [
        lm.to_vec(),
        nt.to_vec(),
        utf16(domain),
        utf16(user),
        Vec::new(),
        Vec::new(),
    ];
    let mut m = Vec::new();
    m.extend_from_slice(SIG);
    m.extend_from_slice(&3u32.to_le_bytes());
    let mut at = 12 + 6 * 8 + 4;
    for p in &parts {
        m.extend_from_slice(&(p.len() as u16).to_le_bytes());
        m.extend_from_slice(&(p.len() as u16).to_le_bytes());
        m.extend_from_slice(&(at as u32).to_le_bytes());
        at += p.len();
    }
    m.extend_from_slice(&flags.to_le_bytes());
    for p in &parts {
        m.extend_from_slice(p);
    }
    m
}

fn field(m: &[u8], at: usize) -> Option<&[u8]> {
    let len = u16::from_le_bytes(m.get(at..at + 2)?.try_into().ok()?) as usize;
    let off = u32le(m, at + 4) as usize;
    m.get(off..off.checked_add(len)?)
}

/// One AV_PAIR's value from target info.
fn av(mut info: &[u8], id: u16) -> Option<&[u8]> {
    while info.len() >= 4 {
        let (k, len) = (
            u16::from_le_bytes([info[0], info[1]]),
            u16::from_le_bytes([info[2], info[3]]) as usize,
        );
        let v = info.get(4..4 + len)?;
        if k == id {
            return Some(v);
        }
        if k == 0 {
            break;
        }
        info = &info[4 + len..];
    }
    None
}

fn u32le(b: &[u8], at: usize) -> u32 {
    b.get(at..at + 4)
        .map_or(0, |v| u32::from_le_bytes(v.try_into().unwrap()))
}

pub(crate) fn utf16(s: &str) -> Vec<u8> {
    s.encode_utf16().flat_map(u16::to_le_bytes).collect()
}

fn filetime_now() -> u64 {
    let unix = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    (unix.as_secs() + 11_644_473_600) * 10_000_000 + u64::from(unix.subsec_nanos() / 100)
}

fn hmac_md5(key: &[u8], parts: &[&[u8]]) -> [u8; 16] {
    let mut mac = <Hmac<Md5> as KeyInit>::new_from_slice(key).expect("any key length");
    for p in parts {
        mac.update(p);
    }
    mac.finalize().into_bytes().into()
}

/// MD4 (RFC 1320), only for the NT hash of the password.
fn md4(data: &[u8]) -> [u8; 16] {
    let mut msg = data.to_vec();
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&((data.len() as u64) * 8).to_le_bytes());
    let mut h: [u32; 4] = [0x6745_2301, 0xefcd_ab89, 0x98ba_dcfe, 0x1032_5476];
    for block in msg.chunks(64) {
        let x: Vec<u32> = block
            .chunks(4)
            .map(|w| u32::from_le_bytes(w.try_into().unwrap()))
            .collect();
        let [mut a, mut b, mut c, mut d] = h;
        let f = |x: u32, y: u32, z: u32| (x & y) | (!x & z);
        let g = |x: u32, y: u32, z: u32| (x & y) | (x & z) | (y & z);
        let hh = |x: u32, y: u32, z: u32| x ^ y ^ z;
        for i in 0..16 {
            let s = [3, 7, 11, 19][i % 4];
            let t = a.wrapping_add(f(b, c, d)).wrapping_add(x[i]).rotate_left(s);
            (a, b, c, d) = (d, t, b, c);
        }
        for i in 0..16 {
            let s = [3, 5, 9, 13][i % 4];
            let k = (i % 4) * 4 + i / 4;
            let t = a
                .wrapping_add(g(b, c, d))
                .wrapping_add(x[k])
                .wrapping_add(0x5a82_7999)
                .rotate_left(s);
            (a, b, c, d) = (d, t, b, c);
        }
        for i in 0..16 {
            let s = [3, 9, 11, 15][i % 4];
            let k = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15][i];
            let t = a
                .wrapping_add(hh(b, c, d))
                .wrapping_add(x[k])
                .wrapping_add(0x6ed9_eba1)
                .rotate_left(s);
            (a, b, c, d) = (d, t, b, c);
        }
        h = [
            h[0].wrapping_add(a),
            h[1].wrapping_add(b),
            h[2].wrapping_add(c),
            h[3].wrapping_add(d),
        ];
    }
    let mut out = [0u8; 16];
    for (o, w) in out.chunks_mut(4).zip(h) {
        o.copy_from_slice(&w.to_le_bytes());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn md4_and_nt_hash() {
        // RFC 1320 vectors, and MS-NLMP 4.2.4.1.1's NTOWFv2 ("User", "Domain", "Password").
        let hex = |b: &[u8]| b.iter().map(|x| format!("{x:02x}")).collect::<String>();
        assert_eq!(hex(&md4(b"")), "31d6cfe0d16ae931b73c59d7e0c089c0");
        assert_eq!(hex(&md4(b"abc")), "a448017aaf21d8525fc10ae87aa6729d");
        let owf = hmac_md5(
            &md4(&utf16("Password")),
            &[&utf16("USER"), &utf16("Domain")],
        );
        assert_eq!(hex(&owf), "0c868a403bfd7a93a3001ef22ef02e3f");
    }
}
