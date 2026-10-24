//! The PS5's ELF loader (elfldr, port 9021) from here: a Dump Forge release it downloads and
//! starts itself (`load_release`: the PS5 server's self-update, and the desktop app's Install on
//! PS5), and any ELF file of this computer streamed to it (`send`: the app's Send a payload).

use std::fs::File;
use std::io::{self, Read, Write};
use std::net::{Shutdown, SocketAddr, TcpStream, ToSocketAddrs};
use std::path::Path;
use std::time::{Duration, Instant};

/// elfldr's port.
pub const PORT: u16 = 9021;
/// The largest ELF `send` takes (a payload is a few MB, Dump Forge's about 16 MB).
const MAX_ELF: u64 = 64 << 20;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
/// The longest `send` may take in all (64 MiB at under 1 MB/s).
const SEND_TIME: Duration = Duration::from_secs(120);

/// `host`, `host:port` or `[v6]:port` (port 9021 by default) as the address to connect to, an
/// IPv4 one first.
// ponytail: one address per name; a host name whose IPv4 address doesn't answer isn't tried
// over IPv6 (a console is typed by its IP).
pub fn address(text: &str) -> io::Result<SocketAddr> {
    let (host, port) = crate::nas::parse_host(text, None, PORT)?;
    let addrs: Vec<SocketAddr> = (host.as_str(), port).to_socket_addrs()?.collect();
    (addrs
        .iter()
        .find(|a| a.is_ipv4())
        .or(addrs.first())
        .copied())
    .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, format!("{host} has no address")))
}

/// A connection to elfldr at `addr`; `NotConnected` when nothing answers there.
fn dial(addr: SocketAddr) -> io::Result<TcpStream> {
    TcpStream::connect_timeout(&addr, CONNECT_TIMEOUT).map_err(|_| {
        io::Error::new(
            io::ErrorKind::NotConnected,
            format!("nothing answers at {addr}: start the PS5's ELF loader, then try again"),
        )
    })
}

/// Asks elfldr at `addr` to download v`version`'s PS5 ELF from its GitHub release and start it
/// with `serve`: `GET /?uri=<that URL>`, `args` and `pipe` inside the URL's own query (elfldr
/// reads them from there). elfldr answers 200 at once, then downloads and spawns, writing any
/// failure into the body; with `pipe=0` it closes once spawned. The new process takes the port
/// over from a Forge already running there (`serve`'s handover) once that one is idle.
/// `NotConnected` when elfldr doesn't answer.
// ponytail: elfldr ignores certificate errors and nothing checks a signature (anyone who can
// intercept the console's traffic can serve an ELF); it reads the body once without checking its
// length, so a short read could start a cut ELF.
pub fn load_release(addr: SocketAddr, version: &str) -> io::Result<()> {
    if !crate::api::plain_version(version) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("{version:?} is not a release version (X.Y.Z)"),
        ));
    }
    let uri = format!(
        "https://github.com/quer3q/ps5-dump-forge/releases/download/v{version}/\
         ps5-dump-forge-{version}-ps5.elf?args=serve&pipe=0"
    );
    let stream = dial(addr)?;
    let request = format!(
        "GET /?uri={} HTTP/1.1\r\nHost: {addr}\r\nConnection: close\r\n\r\n",
        crate::api::percent_encode(&uri)
    );
    let failed = |why: &str| {
        io::Error::other(format!(
            "elfldr couldn't download or start v{version}: {why}"
        ))
    };
    // The download (~16 MB) happens inside this reply; within a page's minute.
    let reply = crate::ask(
        stream,
        &request,
        Instant::now() + Duration::from_secs(55),
        64 * 1024,
    )
    .map_err(|e| failed(&e.to_string()))?;
    if crate::status_of(&reply) != Some(200) {
        return Err(io::Error::other("elfldr refused the request"));
    }
    let text = String::from_utf8_lossy(&reply);
    let body = text.split_once("\r\n\r\n").map_or("", |(_, body)| body);
    match body.lines().find(|l| l.contains("Error")) {
        Some(line) => Err(failed(line.trim())),
        None => Ok(()),
    }
}

/// Streams the ELF file at `path` to elfldr at `addr`, which runs it; the bytes sent. Refused:
/// a file that isn't an ELF or is over 64 MiB. elfldr gives no answer, so a sent payload that
/// fails to start isn't seen here.
pub fn send(addr: SocketAddr, path: &Path) -> io::Result<u64> {
    // Checked before the open: opening a FIFO would wait for a writer.
    let meta = std::fs::metadata(path)?;
    if !meta.is_file() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("{} is not a file", path.display()),
        ));
    }
    let mut file = File::open(path)?;
    let meta = file.metadata()?;
    let len = meta.len();
    let mut magic = [0u8; 4];
    if !meta.is_file()
        || len > MAX_ELF
        || file.read_exact(&mut magic).is_err()
        || magic != *b"\x7fELF"
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!(
                "{} is not an ELF payload (an ELF file of at most 64 MiB)",
                path.display()
            ),
        ));
    }
    let mut stream = dial(addr)?;
    stream.set_write_timeout(Some(Duration::from_secs(30)))?;
    stream.write_all(&magic)?;
    // 1 MiB at a time within `SEND_TIME` in all; a file that ends early is an error, not a cut ELF.
    let deadline = Instant::now() + SEND_TIME;
    let (mut sent, mut buf) = (4u64, vec![0u8; 1 << 20]);
    while sent < len {
        if Instant::now() >= deadline {
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                format!("sending to {addr} took too long"),
            ));
        }
        let n = file.read(&mut buf[..(len - sent).min(1 << 20) as usize])?;
        if n == 0 {
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                format!("{} got shorter while it was sent", path.display()),
            ));
        }
        stream.write_all(&buf[..n])?;
        sent += n as u64;
    }
    stream.flush()?;
    stream.shutdown(Shutdown::Write)?;
    // Whatever elfldr writes back (a payload's output with some loaders) is left unread; a
    // short wait lets it take the last bytes before the close.
    stream.set_read_timeout(Some(Duration::from_secs(2)))?;
    let _ = stream.read(&mut [0u8; 256]);
    Ok(sent)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;

    #[test]
    fn an_elf_is_streamed_whole_and_anything_else_refused() {
        let dir = std::env::temp_dir().join(format!("forge-payload-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let elf = dir.join("x.elf");
        let body: Vec<u8> = b"\x7fELF"
            .iter()
            .copied()
            .chain((0..300_000u32).map(|i| i as u8))
            .collect();
        std::fs::write(&elf, &body).unwrap();
        let other = dir.join("x.bin");
        std::fs::write(&other, b"MZ not an elf").unwrap();

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let got = std::thread::spawn(move || {
            let (mut s, _) = listener.accept().unwrap();
            let mut all = Vec::new();
            s.read_to_end(&mut all).unwrap();
            all
        });
        assert_eq!(send(addr, &elf).unwrap(), body.len() as u64);
        assert_eq!(got.join().unwrap(), body);

        let e = send(addr, &other).unwrap_err();
        assert_eq!(e.kind(), io::ErrorKind::InvalidInput);
        assert!(send(addr, &dir).is_err(), "a folder");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn addresses_default_to_elfldr_s_port_and_versions_are_checked() {
        assert_eq!(
            address("127.0.0.1").unwrap(),
            "127.0.0.1:9021".parse().unwrap()
        );
        assert_eq!(address("127.0.0.1:9020").unwrap().port(), 9020);
        assert!(address("a b").is_err());
        let closed = TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap();
        assert_eq!(
            load_release(closed, "1.2").unwrap_err().kind(),
            io::ErrorKind::InvalidInput
        );
        assert_eq!(
            load_release(closed, "1.2.3").unwrap_err().kind(),
            io::ErrorKind::NotConnected
        );
    }
}
