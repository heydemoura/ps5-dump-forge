//! A small blocking NFS client: NFSv4.1 (RFC 8881) first, else NFSv3 (RFC 1813), over ONC RPC
//! on TCP (`rpc`). Absolute server paths (`/srv/games/My Game/eboot.bin`); lists, stats and reads
//! files, creates files and folders (never replacing), renames without replacing, removes.
// ponytail: one TCP connection per [`Session`], requests serialized under a Mutex; no reconnect.

use std::io;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::SystemTime;

mod rpc;
mod v3;
mod v4;

pub const DEFAULT_PORT: u16 = 2049;

/// Whether an NFS server answers on `stream` (connected by the caller, who bounds the whole
/// exchange): an RPC NULL call to the NFS program (version 3; a reply naming the versions it
/// serves instead counts too), `timeout` for each read and write. From any source port (NULL
/// needs no privileged one).
pub fn probe(stream: std::net::TcpStream, timeout: std::time::Duration) -> io::Result<()> {
    match rpc::Client::over(stream, timeout)?.null(v4::PROGRAM, 3) {
        Err(e) if matches!(rpc::rpc_error(&e), Some(rpc::RpcError::ProgMismatch { .. })) => Ok(()),
        r => r,
    }
}

/// A directory entry or a stat result. `link` marks a symbolic link (never followed), `special`
/// anything that is neither a file, a folder nor a link (devices, FIFOs, sockets).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entry {
    pub name: String,
    pub dir: bool,
    pub size: u64,
    pub mtime: Option<SystemTime>,
    pub link: bool,
    pub special: bool,
}

/// The protocol a session speaks.
enum Proto {
    V3(v3::Nfs3),
    V4(v4::Nfs4),
}

/// One connection to a server. Clones share the connection.
#[derive(Clone)]
pub struct Session(Arc<Mutex<Proto>>);

/// A file this session created, open for writing (v4: its open state, closed on drop).
pub struct File {
    session: Session,
    path: String,
    open: Open,
}

enum Open {
    V3(v3::Open),
    V4(v4::Open),
}

/// Runs `$call` on whichever protocol the session speaks.
macro_rules! each {
    ($proto:expr, $p:ident => $call:expr) => {
        match $proto {
            Proto::V3($p) => $call,
            Proto::V4($p) => $call,
        }
    };
}

impl Session {
    /// Connects to `host` (a name or an IP; the port `port`, else [`DEFAULT_PORT`] for v4.1 and
    /// the portmapper's for v3): NFSv4.1 first, NFSv3 when the server has no v4.1.
    pub fn connect(host: &str, port: Option<u16>) -> io::Result<Session> {
        let proto = match v4::Nfs4::connect(host, port) {
            Ok(c) => Proto::V4(c),
            Err(e) if fall_back(&e) => match v3::Nfs3::connect(host, port) {
                Ok(c) => Proto::V3(c),
                Err(e3) => {
                    return Err(io::Error::new(
                        e3.kind(),
                        format!("NFSv4.1 on {host}: {e}; NFSv3: {e3}"),
                    ));
                }
            },
            Err(e) => return Err(e),
        };
        Ok(Session(Arc::new(Mutex::new(proto))))
    }

    fn lock(&self) -> MutexGuard<'_, Proto> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// `"NFSv4.1"` or `"NFSv3"` (for logs).
    pub fn version(&self) -> &'static str {
        match *self.lock() {
            Proto::V3(_) => "NFSv3",
            Proto::V4(_) => "NFSv4.1",
        }
    }

    /// The server's exports (v4 may give `["/"]`: its pseudo-filesystem).
    pub fn exports(&self) -> io::Result<Vec<String>> {
        each!(&mut *self.lock(), p => p.exports())
    }

    pub fn stat(&self, path: &str) -> io::Result<Entry> {
        each!(&mut *self.lock(), p => p.stat(path)).map_err(|e| named(e, path))
    }

    /// A folder's entries without `.` and `..`; more than 200,000 is an error.
    pub fn list(&self, path: &str) -> io::Result<Vec<Entry>> {
        each!(&mut *self.lock(), p => p.list(path)).map_err(|e| named(e, path))
    }

    /// Up to `len` bytes at `offset`; fewer only at the end of the file.
    pub fn read_at(&self, path: &str, offset: u64, len: usize) -> io::Result<Vec<u8>> {
        each!(&mut *self.lock(), p => p.read_at(path, offset, len)).map_err(|e| named(e, path))
    }

    /// A new folder (mode 0777); `AlreadyExists` when something is there.
    pub fn mkdir(&self, path: &str) -> io::Result<()> {
        each!(&mut *self.lock(), p => p.mkdir(path)).map_err(|e| named(e, path))
    }

    /// A new empty file (mode 0666), never replacing one: `AlreadyExists` when taken.
    pub fn create(&self, path: &str) -> io::Result<File> {
        let open = match &mut *self.lock() {
            Proto::V3(p) => p.create(path).map(Open::V3),
            Proto::V4(p) => p.create(path).map(Open::V4),
        }
        .map_err(|e| named(e, path))?;
        Ok(File {
            session: self.clone(),
            path: path.to_string(),
            open,
        })
    }

    /// Renames `from` to `to`, never replacing what is at `to` (`AlreadyExists`).
    pub fn rename_no_replace(&self, from: &str, to: &str) -> io::Result<()> {
        each!(&mut *self.lock(), p => p.rename_no_replace(from, to))
            .map_err(|e| named(e, &format!("{from} -> {to}")))
    }

    /// Renames the file `from` to `to`, replacing a file there (never a folder).
    pub fn rename_replace(&self, from: &str, to: &str) -> io::Result<()> {
        each!(&mut *self.lock(), p => p.rename_replace(from, to))
            .map_err(|e| named(e, &format!("{from} -> {to}")))
    }

    /// Removes a file.
    pub fn remove(&self, path: &str) -> io::Result<()> {
        each!(&mut *self.lock(), p => p.remove(path)).map_err(|e| named(e, path))
    }

    /// Bytes free for us on the filesystem holding `path`.
    pub fn free_space(&self, path: &str) -> io::Result<u64> {
        each!(&mut *self.lock(), p => p.free_space(path)).map_err(|e| named(e, path))
    }
}

impl File {
    /// Writes `bytes` at `offset` (unstable: [`File::sync`] makes it durable).
    pub fn write_at(&self, offset: u64, bytes: &[u8]) -> io::Result<()> {
        match (&mut *self.session.lock(), &self.open) {
            (Proto::V3(p), Open::V3(o)) => p.write_at(o, offset, bytes),
            (Proto::V4(p), Open::V4(o)) => p.write_at(o, offset, bytes),
            _ => unreachable!("a file opened by the session's own protocol"),
        }
        .map_err(|e| named(e, &self.path))
    }

    /// Commits every write so far to stable storage; fails when the server restarted since
    /// (its write verifier changed: the unstable writes may be lost).
    pub fn sync(&self) -> io::Result<()> {
        match (&mut *self.session.lock(), &self.open) {
            (Proto::V3(p), Open::V3(o)) => p.sync(o),
            (Proto::V4(p), Open::V4(o)) => p.sync(o),
            _ => unreachable!("a file opened by the session's own protocol"),
        }
        .map_err(|e| named(e, &self.path))
    }
}

impl Drop for File {
    fn drop(&mut self) {
        if let (Proto::V4(p), Open::V4(o)) = (&mut *self.session.lock(), &self.open) {
            p.close(o); // best effort
        }
    }
}

/// When v4.1 failing means "try v3": the server doesn't serve it (RPC version or program
/// mismatch, NFS4ERR_MINOR_VERS_MISMATCH, which v4.rs reports as `Unsupported`) or refused the
/// connection (v3 may be on another port).
fn fall_back(e: &io::Error) -> bool {
    rpc::is_version_mismatch(e)
        || matches!(
            e.kind(),
            io::ErrorKind::Unsupported | io::ErrorKind::ConnectionRefused
        )
}

/// `e` with the path it concerns in front of its text, its kind kept.
fn named(e: io::Error, path: &str) -> io::Error {
    io::Error::new(e.kind(), format!("{path}: {e}"))
}
