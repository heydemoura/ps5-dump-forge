//! Entries read straight out of an archive, in whatever order the caller asks, with nothing
//! unpacked to disk. A session decodes the archive front to back on its own thread (UnRAR and
//! sevenz-rust2 push their data through callbacks) and hands over the asked-for entry's bytes
//! through a bounded queue, skipping the entries before it. An entry the session has already
//! gone past starts a new session from the archive's start: cheap for a non-solid archive (a
//! skip reads headers only), a decode of everything before it for a solid one.

use super::*;
use std::{
    collections::{HashMap, HashSet},
    sync::{Arc, Mutex},
    thread::JoinHandle,
    time::Duration,
};

/// Chunks in flight from a session (each at most 64 KiB).
const QUEUE: usize = 64;

/// Reads entries of one archive, a session at a time.
pub struct Reader {
    path: PathBuf,
    // Never logged or shown: `Reader` has no `Debug`.
    password: Option<String>,
    listing: Arc<Listing>,
    sizes: HashMap<String, u64>,
    /// Files listed as empty: no read ever asks for them, so a session decodes each it goes
    /// past, and one that holds data fails it.
    empty: Arc<HashSet<String>>,
    /// The caller's cancel flag: every wait for the session checks it.
    cancel: Arc<AtomicBool>,
    session: Option<Session>,
}

enum Msg {
    Chunk(Vec<u8>),
    End,
    /// The walk reached the archive's end without the asked-for entry.
    Missing,
    Failed(ArchiveError),
}

struct Session {
    target: Option<mpsc::SyncSender<String>>,
    data: Option<mpsc::Receiver<Msg>>,
    stop: Arc<AtomicBool>,
    /// Entries this session went past (skipped or served).
    passed: Arc<Mutex<HashSet<String>>>,
    /// The entry asked for, its size, the bytes of it handed out, and whether its end (and
    /// with it the archive's own check of it: a CRC, a checksum) has come.
    current: String,
    size: u64,
    at: u64,
    ended: bool,
    cancel: Arc<AtomicBool>,
    /// What the last chunk had left over.
    pending: Vec<u8>,
    thread: Option<JoinHandle<()>>,
}

impl Drop for Session {
    fn drop(&mut self) {
        // Both queues closed: a producer waiting on either stops, then lets go of the archive
        // (and of UnRAR's lock) before the next session opens it.
        self.stop.store(true, Ordering::Relaxed);
        self.target = None;
        self.data = None;
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

impl Reader {
    /// `listing` is the archive's own ([`list`] with the same password); `cancel` stops a
    /// read that waits on the archive (a long skip through solid data) with `Cancelled`.
    pub fn new(
        path: &Path,
        password: Option<&str>,
        listing: Listing,
        cancel: Arc<AtomicBool>,
    ) -> Reader {
        let sizes = (listing.entries.iter())
            .map(|e| (e.path.clone(), e.size))
            .collect();
        let empty = (listing.entries.iter())
            .filter(|e| !e.dir && e.size == 0)
            .map(|e| e.path.clone())
            .collect();
        Reader {
            path: path.to_owned(),
            password: password.map(str::to_owned),
            listing: Arc::new(listing),
            sizes,
            empty: Arc::new(empty),
            cancel,
            session: None,
        }
    }

    /// Up to `len` bytes of `entry` from `offset`; fewer only at the entry's end.
    pub fn read_at(
        &mut self,
        entry: &str,
        offset: u64,
        len: usize,
    ) -> Result<Vec<u8>, ArchiveError> {
        let result = self.try_read(entry, offset, len);
        if result.is_err() {
            self.session = None;
        }
        result
    }

    fn try_read(&mut self, entry: &str, offset: u64, len: usize) -> Result<Vec<u8>, ArchiveError> {
        let mut fresh = false;
        loop {
            if !self.moved_to(entry, offset)? {
                if fresh {
                    return Err(corrupt(&format!("{entry} is not in the archive.")));
                }
                self.start(entry)?;
                fresh = true;
                continue;
            }
            let s = self.session.as_mut().expect("moved to the entry");
            // Sized once (what is left of the entry, at most `len`): grown in steps, every read
            // would leave a trail of freed large blocks behind.
            let left = usize::try_from(s.size.saturating_sub(s.at)).unwrap_or(usize::MAX);
            let mut out = Vec::with_capacity(len.min(left));
            match s.fill(&mut out, len)? {
                // At the entry's end, its end comes first: the archive's check of it fails
                // the read that completes it, not a later one nobody makes.
                true if s.at >= s.size && !s.ended => {
                    if !s.fill(&mut Vec::new(), 1)? || !s.ended {
                        return Err(corrupt(&format!(
                            "{entry} is longer than the archive lists."
                        )));
                    }
                    return Ok(out);
                }
                true => return Ok(out),
                // A forward walk that missed it (a ZIP or 7z skip records nothing): once more,
                // from the archive's start.
                false if !fresh => {
                    self.start(entry)?;
                    fresh = true;
                }
                false => return Err(corrupt(&format!("{entry} is not in the archive."))),
            }
        }
    }

    /// Whether the session now serves `entry` from `offset`; false when a new one must.
    fn moved_to(&mut self, entry: &str, offset: u64) -> Result<bool, ArchiveError> {
        let Some(s) = self.session.as_mut() else {
            return Ok(false);
        };
        if s.current == entry {
            if s.at > offset || (s.ended && offset < s.at) {
                return Ok(false);
            }
            // Ahead in this entry: read up to it.
            let mut skip = offset - s.at;
            while skip > 0 && !s.ended {
                let mut gone = Vec::with_capacity(skip.min(1 << 20) as usize);
                if !s.fill(&mut gone, skip.min(1 << 20) as usize)? {
                    return Ok(false);
                }
                skip -= gone.len() as u64;
            }
            return Ok(true);
        }
        // Another entry: the current one must be done (its end taken) first.
        if !s.ended {
            if s.at < s.size || !s.pending.is_empty() {
                return Ok(false);
            }
            if !s.fill(&mut Vec::new(), 1)? || !s.ended {
                return Ok(false);
            }
        }
        if s.passed
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .contains(entry)
        {
            return Ok(false);
        }
        if !s
            .target
            .as_ref()
            .is_some_and(|t| t.send(entry.to_owned()).is_ok())
        {
            return Ok(false);
        }
        s.current = entry.to_owned();
        s.size = self.sizes.get(entry).copied().unwrap_or(0);
        s.at = 0;
        s.ended = false;
        // Then up to `offset` in it.
        self.moved_to(entry, offset)
    }

    /// A new session from the archive's start, serving `entry` first.
    fn start(&mut self, entry: &str) -> Result<(), ArchiveError> {
        self.session = None;
        let stop = Arc::new(AtomicBool::new(false));
        let (target_tx, target_rx) = mpsc::sync_channel::<String>(1);
        let (data_tx, data_rx) = mpsc::sync_channel(QUEUE);
        let passed = Arc::new(Mutex::new(HashSet::new()));
        let mut feed = Feed {
            target_rx,
            data_tx,
            passed: passed.clone(),
            target: Some(entry.to_owned()),
            stop: stop.clone(),
            empty: self.empty.clone(),
            checking: None,
        };
        let (path, password, listing) = (
            self.path.clone(),
            self.password.clone(),
            self.listing.clone(),
        );
        let thread = std::thread::Builder::new()
            .name("forge-archive".into())
            .spawn(move || {
                let stop = feed.stop.clone();
                let last = match walk(&path, password.as_deref(), &listing, &mut feed, &stop) {
                    Err(e) => Msg::Failed(e),
                    Ok(()) if feed.target.is_some() => Msg::Missing,
                    Ok(()) => return,
                };
                let _ = feed.data_tx.send(last);
            })?;
        self.session = Some(Session {
            target: Some(target_tx),
            data: Some(data_rx),
            stop,
            passed,
            current: entry.to_owned(),
            size: self.sizes.get(entry).copied().unwrap_or(0),
            at: 0,
            ended: false,
            cancel: self.cancel.clone(),
            pending: Vec::new(),
            thread: Some(thread),
        });
        Ok(())
    }
}

impl Session {
    /// Appends up to `len` bytes of the current entry to `out`, fewer at its end. False: the
    /// session went to the archive's end without the entry.
    fn fill(&mut self, out: &mut Vec<u8>, len: usize) -> Result<bool, ArchiveError> {
        while out.len() < len && !self.ended {
            check(&self.cancel)?;
            if self.pending.is_empty() {
                let data = self.data.as_ref().expect("an open session");
                match data.recv_timeout(Duration::from_millis(100)) {
                    Ok(Msg::Chunk(b)) => self.pending = b,
                    Ok(Msg::End) => self.ended = true,
                    Ok(Msg::Missing) => return Ok(false),
                    Ok(Msg::Failed(e)) => return Err(e),
                    Err(mpsc::RecvTimeoutError::Timeout) => check(&self.cancel)?,
                    Err(mpsc::RecvTimeoutError::Disconnected) => {
                        return Err(corrupt("The archive reader stopped."));
                    }
                }
                continue;
            }
            let n = (len - out.len()).min(self.pending.len());
            out.extend_from_slice(&self.pending[..n]);
            self.pending.drain(..n);
            self.at += n as u64;
        }
        Ok(true)
    }
}

/// The session's side: serves each asked-for entry, skips the rest.
struct Feed {
    target_rx: mpsc::Receiver<String>,
    data_tx: mpsc::SyncSender<Msg>,
    passed: Arc<Mutex<HashSet<String>>>,
    target: Option<String>,
    stop: Arc<AtomicBool>,
    empty: Arc<HashSet<String>>,
    /// An empty file being decoded in passing (never handed out).
    checking: Option<String>,
}

impl Feed {
    /// The entry asked for, waiting for the reader to ask; `None` once the reader is gone.
    fn target(&mut self) -> Option<&str> {
        if self.target.is_none() {
            match self.target_rx.recv() {
                Ok(t) => self.target = Some(t),
                Err(_) => self.stop.store(true, Ordering::Relaxed),
            }
        }
        self.target.as_deref()
    }
    fn pass(&self, path: &str) {
        let mut passed = self.passed.lock().unwrap_or_else(|p| p.into_inner());
        passed.insert(path.to_owned());
    }
    fn send(&self, m: Msg) -> Result<(), ArchiveError> {
        self.data_tx.send(m).map_err(|_| ArchiveError::Cancelled)
    }
}

impl Sink for Feed {
    fn wants(&mut self, p: &str) -> bool {
        // A ZIP record or a 7z block's entries, before any decoding: the target, and an empty
        // file to check.
        let wanted = self.target().is_some_and(|t| t == p) || self.empty.contains(p);
        if !wanted {
            self.pass(p);
        }
        wanted
    }
    fn begin(&mut self, e: &Entry) -> Result<bool, ArchiveError> {
        let Some(t) = self.target() else {
            return Err(ArchiveError::Cancelled);
        };
        if t == e.path && !e.dir {
            return Ok(true);
        }
        if self.empty.contains(&e.path) {
            self.checking = Some(e.path.clone());
            return Ok(true);
        }
        self.pass(&e.path);
        Ok(false)
    }
    fn chunk(&mut self, b: &[u8]) -> Result<(), ArchiveError> {
        if let Some(p) = &self.checking {
            return Err(corrupt(&format!("{p} is longer than the archive lists.")));
        }
        self.send(Msg::Chunk(b.to_vec()))
    }
    fn end(&mut self) -> Result<(), ArchiveError> {
        if let Some(p) = self.checking.take() {
            self.pass(&p);
            return Ok(());
        }
        if let Some(t) = self.target.take() {
            self.pass(&t);
        }
        self.send(Msg::End)
    }
    fn done(&self) -> bool {
        self.stop.load(Ordering::Relaxed)
    }
}
