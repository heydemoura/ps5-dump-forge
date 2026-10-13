//! The routes. Each mirrors a Tauri command in `app/src-tauri/src/main.rs`: the same core
//! call on the paths as given and the same `format!("{e:#}")` error text. The server adds
//! only limits: on jobs, concurrent inspections and listing sizes.

use std::collections::BTreeSet;
use std::net::{SocketAddr, TcpStream};
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicI64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Instant;

use ps5_dump_forge_core::{
    ArchivePassword, ConvertRequest, DeleteError, Event, Format, JobId, Jobs,
};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::json;

use crate::http::{self, Head, Response};
use crate::paths::{Roots, Storage};
use crate::table::{self, Table};
use crate::{Options, Platform, random_hex};

include!(concat!(env!("OUT_DIR"), "/assets.rs"));

const MAX_JOBS: i64 = 8;
/// Inspecting or naming reads a source's metadata (a whole image's, for an inspection); more
/// at once only slows the console down.
const MAX_INSPECTIONS: usize = 2;
/// How long a read waits for one of those slots before its 429: picking a source starts its
/// inspection and its naming together, and an archive's take a while. At most [`MAX_WAITING`]
/// wait at once (a 429 at once past that), so waiting reads never hold the handlers that
/// Cancel and Stop need.
const MAX_WAITING: usize = 4;
const SLOT_WAIT: std::time::Duration = if cfg!(test) {
    std::time::Duration::from_millis(100)
} else {
    std::time::Duration::from_secs(30)
};
const LIST_MAX: usize = 10_000;
const STALE_MAX: usize = 1_000;

type Reply = Result<Response, Response>;

pub(crate) struct Server {
    pub opts: Options,
    /// `http://<address>:<port>` as shown to the user.
    pub url: String,
    roots: Roots,
    instance: String,
    jobs: Jobs,
    table: Arc<Mutex<Table>>,
    /// Admitted minus finished jobs; only raised under `admission`, lowered by `Done`.
    running: Arc<AtomicI64>,
    /// Held from the admission checks until the job is in the table, so admitting and
    /// stopping never interleave.
    admission: Mutex<()>,
    stopping: AtomicBool,
    inspecting: AtomicUsize,
    /// Reads waiting in [`Server::capped`] for a slot.
    waiting: AtomicUsize,
    cores: usize,
    /// Tests widen the gap between `Jobs::start` returning and the table admitting the job.
    #[cfg(test)]
    admit_pause: std::time::Duration,
}

/// `POST /api/library_scan`'s reply: core's scan, plus `storage` on the PS5 only.
#[derive(serde::Serialize)]
struct ScanReply<'a> {
    #[serde(flatten)]
    scan: &'a ps5_dump_forge_core::LibraryScan,
    #[serde(skip_serializing_if = "Option::is_none")]
    storage: Option<Storage>,
}

/// A lock that survives a panic elsewhere (the data stays consistent per call).
fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

fn parse<T: DeserializeOwned>(body: &[u8]) -> Result<T, Response> {
    serde_json::from_slice(body).map_err(|e| Response::error(400, format!("bad request: {e}")))
}

/// Core's `anyhow` error with its causes, as the Tauri commands return it.
fn core(e: impl std::fmt::Display) -> Response {
    Response::error(500, format!("{e:#}"))
}

/// What an inspection or a naming request may read: a folder or a regular file, symlinks
/// followed. A FIFO or device would block its handler (or a job, and quit with it) on open.
/// Anything missing is left for core to report.
// ponytail: checked by path, then opened by core by path; swapping in a FIFO between the
// two needs write access to the storage.
fn readable(path: &Path) -> Result<(), Response> {
    match std::fs::metadata(path) {
        Ok(meta) if !meta.is_dir() && !meta.is_file() => Err(Response::error(
            400,
            format!("{}: not a folder or a regular file", path.display()),
        )),
        _ => Ok(()),
    }
}

/// One running inspection; frees its place even when core panics.
struct Inspecting<'a>(&'a AtomicUsize);

impl Drop for Inspecting<'_> {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}

/// A JSON object whose optional `root` is a string (else 400).
fn optional_root(body: &[u8]) -> Result<Option<PathBuf>, Response> {
    match parse::<serde_json::Value>(body)? {
        serde_json::Value::Object(o) => match o.get("root") {
            None => Ok(None),
            Some(serde_json::Value::String(s)) => Ok(Some(PathBuf::from(s))),
            Some(_) => Err(Response::error(400, "bad request: root must be a string")),
        },
        _ => Err(Response::error(400, "bad request: expected a JSON object")),
    }
}

#[derive(Deserialize)]
struct PathArg {
    path: PathBuf,
}

/// `/api/inspect`: `password` for an archive that needs one (never logged or echoed).
#[derive(Deserialize)]
struct InspectArg {
    path: PathBuf,
    #[serde(default)]
    password: Option<ArchivePassword>,
}

/// `/api/default_output`, `/api/generated_output`: `password` for an archive that needs one
/// (never logged or echoed).
#[derive(Deserialize)]
struct OutputArg {
    source: PathBuf,
    format: Format,
    dir: PathBuf,
    #[serde(default)]
    taken: Vec<PathBuf>,
    #[serde(default)]
    password: Option<ArchivePassword>,
}

#[derive(Deserialize)]
struct StartArg {
    request: ConvertRequest,
}

#[derive(Deserialize)]
struct SourceArg {
    source: PathBuf,
}

#[derive(Deserialize)]
struct IdArg {
    id: JobId,
}

#[derive(Deserialize)]
struct DirsArg {
    dirs: Vec<PathBuf>,
}

#[derive(Deserialize)]
struct ListArg {
    #[serde(default)]
    path: Option<String>,
}

impl Server {
    pub fn new(opts: Options, local: SocketAddr) -> std::io::Result<Self> {
        let (roots, notes) = Roots::new(opts.platform, &opts.roots);
        for line in &notes {
            eprintln!("ps5-dump-forge serve: {line}");
        }
        if opts.platform == Platform::Host && roots.current().is_empty() {
            return Err(std::io::Error::other("no usable --root folder"));
        }
        let table = Arc::new(Mutex::new(Table::default()));
        let running = Arc::new(AtomicI64::new(0));
        let jobs = {
            let (table, running) = (table.clone(), running.clone());
            Jobs::new(move |event| {
                if let Event::Done { .. } = event {
                    running.fetch_sub(1, Ordering::SeqCst);
                }
                lock(&table).record(&event);
            })
        };
        let cores = std::thread::available_parallelism().map_or(1, |n| n.get());
        Ok(Self {
            url: crate::console_url(local, opts.platform),
            instance: random_hex(8)?,
            roots,
            jobs,
            table,
            running,
            admission: Mutex::new(()),
            stopping: AtomicBool::new(false),
            inspecting: AtomicUsize::new(0),
            waiting: AtomicUsize::new(0),
            cores,
            opts,
            #[cfg(test)]
            admit_pause: std::time::Duration::ZERO,
        })
    }

    pub fn handle(self: &Arc<Self>, mut stream: TcpStream) {
        let deadline = Instant::now() + self.opts.deadline;
        let mut response =
            match catch_unwind(AssertUnwindSafe(|| self.respond(&mut stream, deadline))) {
                Ok(r) => r,
                Err(_) => Response::error(500, "internal error"),
            };
        let after = response.after.take();
        http::send(&mut stream, &mut response, self.opts.write_timeout);
        if let Some(after) = after {
            after();
        }
    }

    fn respond(self: &Arc<Self>, stream: &mut TcpStream, deadline: Instant) -> Response {
        let mut head = match http::read_head(stream, deadline) {
            Ok(head) => head,
            Err(r) => return r,
        };
        match http::read_body(stream, &mut head, deadline) {
            Ok(body) => self.route(&head, &body).unwrap_or_else(|r| r),
            Err(r) => r,
        }
    }

    fn route(self: &Arc<Self>, head: &Head, body: &[u8]) -> Reply {
        let post = head.method == "POST";
        let Some(api) = head.path.strip_prefix("/api/") else {
            return if post {
                Err(Response::error(404, "unknown route"))
            } else {
                self.asset(&head.path)
            };
        };
        match (post, api) {
            (false, "session") => Ok(self.session()),
            (false, "qr") => self.qr(),
            (true, "inspect") => self.inspect(body),
            (true, "default_output") => {
                let arg: OutputArg = parse(body)?;
                readable(&arg.source)?;
                let password = arg.password.as_ref().map(ArchivePassword::as_str);
                let out = self.capped(|| {
                    ps5_dump_forge_core::default_output_with(
                        &arg.source,
                        arg.format,
                        &arg.dir,
                        password,
                    )
                })?;
                Ok(Response::json(&out))
            }
            (true, "generated_output") => {
                let arg: OutputArg = parse(body)?;
                readable(&arg.source)?;
                let password = arg.password.as_ref().map(ArchivePassword::as_str);
                let out = self.capped(|| {
                    ps5_dump_forge_core::generated_output_with(
                        &arg.source,
                        arg.format,
                        &arg.dir,
                        &arg.taken,
                        password,
                    )
                })?;
                Ok(Response::json(&out))
            }
            (true, "start_job") => self.start_job(body),
            (true, "cancel_job") => {
                self.jobs.cancel(parse::<IdArg>(body)?.id);
                Ok(Response::json(&()))
            }
            (true, "stale_parts") => self.stale_parts(body),
            (true, "lz4_plan_profile") => {
                // A Pack `start_job` body; reads only (sampling a few MiB per large file).
                let request = parse::<StartArg>(body)?.request;
                readable(&request.source)?;
                let saved = self.capped(|| ps5_dump_forge_core::lz4_plan_profile(&request))?;
                Ok(Response::json(&saved))
            }
            (true, "lz4_patch") => self.lz4_patch(body, false),
            (true, "lz4_unpatch") => self.lz4_patch(body, true),
            (false, "lz4_traces") => self.lz4_traces(&head.query),
            (true, "list_dir") => self.list_dir(body),
            (true, "delete_path") => self.delete_path(body),
            (true, "library_scan") => self.library_scan(body),
            (true, "library_cover") => self.library_cover(body),
            #[cfg(target_env = "ps5")]
            (true, "debug_bench") if crate::debug::ENABLED => {
                #[derive(Deserialize)]
                struct Q {
                    source: String,
                    dir: String,
                    mib: u64,
                }
                let q: Q = parse(body)?;
                Ok(Response::json(&crate::debug::bench(
                    &q.source, &q.dir, q.mib,
                )))
            }
            #[cfg(target_env = "ps5")]
            (true, "debug") if crate::debug::ENABLED => {
                #[derive(Deserialize)]
                struct Q {
                    path: String,
                }
                let q: Q = parse(body)?;
                Ok(Response::json(&crate::debug::probe(&q.path)))
            }
            (false, "jobs") => Ok(Response::json(&json!({
                "instance": self.instance,
                "jobs": lock(&self.table).snapshot(),
            }))),
            (true, "quit") => {
                parse::<serde_json::Value>(body)?;
                Ok(self.quit())
            }
            _ => Err(Response::error(404, "unknown route")),
        }
    }

    fn asset(&self, path: &str) -> Reply {
        let name = match path {
            "/" => "index.html",
            _ => &path[1..],
        };
        ASSETS
            .iter()
            .find(|(n, _)| *n == name)
            .map(|(n, bytes)| Response::asset(n, bytes))
            .ok_or_else(|| Response::error(404, "not found"))
    }

    fn session(&self) -> Response {
        Response::json(&json!({
            "app": "ps5-dump-forge",
            "version": env!("CARGO_PKG_VERSION"),
            "platform": match self.opts.platform {
                Platform::Ps5 => "ps5",
                Platform::Host => "host",
            },
            "instance": self.instance,
            "stopping": self.stopping.load(Ordering::SeqCst),
            "self_copy": crate::self_copy_status(),
            // The page joins and splits paths with it ("\\" on a Windows host).
            "separator": std::path::MAIN_SEPARATOR_STR,
            // The page shows it: the console's own page is on 127.0.0.1.
            "url": self.url,
        }))
    }

    /// `GET /api/qr`: the session's `url` as a QR code (SVG) for a phone to open. 404 when the
    /// server couldn't tell its IP (its url then names it in words).
    fn qr(&self) -> Reply {
        if self.url.contains(' ') {
            return Err(Response::error(404, "no address to show"));
        }
        let code = qrcode::QrCode::with_error_correction_level(&self.url, qrcode::EcLevel::L)
            .map_err(|e| Response::error(500, format!("internal error: {e}")))?;
        Ok(Response::svg(qr_svg(&code)))
    }

    fn inspect(&self, body: &[u8]) -> Reply {
        let arg: InspectArg = parse(body)?;
        readable(&arg.path)?;
        let password = arg.password.as_ref().map(ArchivePassword::as_str);
        let found = self.capped(|| ps5_dump_forge_core::inspect_with(&arg.path, password))?;
        Ok(Response::json(&found))
    }

    fn refuse_if_stopping(&self) -> Result<(), Response> {
        if self.stopping.load(Ordering::SeqCst) {
            return Err(Response::error(409, "Dump Forge is stopping"));
        }
        Ok(())
    }

    /// The Library scan: the body's `root`, or on the PS5 the configured current roots. Capped
    /// like an inspection, and refused once stopping. On the PS5 the reply also carries the
    /// internal storage's free space (`storage`); a computer's has no such field.
    // ponytail: the request deadline covers receiving the request, not core's work.
    fn library_scan(&self, body: &[u8]) -> Reply {
        let root = optional_root(body)?;
        self.refuse_if_stopping()?;
        if root.is_none() && self.opts.platform == Platform::Host {
            return Err(Response::error(400, "choose a folder to scan"));
        }
        let found = self.capped(|| match &root {
            Some(r) => ps5_dump_forge_core::scan_library_folder(r),
            None => ps5_dump_forge_core::scan_library(&self.roots.library()),
        })?;
        Ok(Response::json(&ScanReply {
            scan: &found,
            storage: self.roots.storage(),
        }))
    }

    /// One Library cover, capped like an inspection, and refused once stopping.
    fn library_cover(&self, body: &[u8]) -> Reply {
        let arg: PathArg = parse(body)?;
        self.refuse_if_stopping()?;
        let cover = self.capped(|| ps5_dump_forge_core::library_cover(&arg.path))?;
        Ok(Response::json(&cover))
    }

    /// Runs a core call that reads a source, at most [`MAX_INSPECTIONS`] at once; the rest
    /// wait for a slot (at most [`MAX_WAITING`] of them), up to [`SLOT_WAIT`], then get a 429.
    /// A 409 once stopping, before and after taking the slot.
    // ponytail: waiters poll, not a queue, so a newcomer can take a freed slot first; FIFO with
    // a Condvar if waits show up unfair on the console.
    fn capped<T, E: std::fmt::Display>(
        &self,
        call: impl FnOnce() -> Result<T, E>,
    ) -> Result<T, Response> {
        let busy = || {
            Response::limited(
                "2 inspections are already running; try again in a moment",
                1,
            )
        };
        self.refuse_if_stopping()?;
        let start = Instant::now();
        let mut waits = None;
        while self.inspecting.fetch_add(1, Ordering::SeqCst) >= MAX_INSPECTIONS {
            self.inspecting.fetch_sub(1, Ordering::SeqCst);
            if waits.is_none() {
                if self.waiting.fetch_add(1, Ordering::SeqCst) >= MAX_WAITING {
                    self.waiting.fetch_sub(1, Ordering::SeqCst);
                    return Err(busy());
                }
                waits = Some(Inspecting(&self.waiting));
            }
            self.refuse_if_stopping()?;
            if start.elapsed() >= SLOT_WAIT {
                return Err(busy());
            }
            std::thread::sleep(std::time::Duration::from_millis(25));
        }
        let _inspecting = Inspecting(&self.inspecting);
        drop(waits);
        self.refuse_if_stopping()?;
        call().map_err(core)
    }

    fn start_job(&self, body: &[u8]) -> Reply {
        let mut request = parse::<StartArg>(body)?.request;
        readable(&request.source)?;
        // Below the core count by default, so the server stays responsive.
        request.compression_threads = Some(match request.compression_threads {
            None => self.cores.saturating_sub(1).max(1),
            Some(n) => n.clamp(1, self.cores),
        });
        let _admission = lock(&self.admission);
        if self.stopping.load(Ordering::SeqCst) {
            return Err(Response::error(409, "Dump Forge is stopping"));
        }
        if self.running.load(Ordering::SeqCst) >= MAX_JOBS {
            return Err(Response::error(
                429,
                "8 jobs are already queued or running; wait for one to finish",
            ));
        }
        self.running.fetch_add(1, Ordering::SeqCst);
        // The table lock is not held here: the event callback needs it, and core can emit
        // (even `Done`) before `start` returns. The table makes an entry on the first event.
        let id =
            catch_unwind(AssertUnwindSafe(|| self.jobs.start(request.clone()))).map_err(|_| {
                self.running.fetch_sub(1, Ordering::SeqCst);
                Response::error(500, "the job runner failed to start the job")
            })?;
        #[cfg(test)]
        std::thread::sleep(self.admit_pause);
        // The job has the password; the table (the page's job list) keeps none.
        request.archive_password = None;
        lock(&self.table).admit(id, request);
        Ok(Response::json(&id))
    }

    /// Patches a game folder in place for LZ4 traces (`unpatch`: undoes it, core's
    /// `lz4_unpatch`). Refused while a job is queued or running (it could be reading the
    /// folder); admission is held throughout, so no job starts and no quit lands mid-patch.
    fn lz4_patch(&self, body: &[u8], unpatch: bool) -> Reply {
        let arg: SourceArg = parse(body)?;
        let _admission = lock(&self.admission);
        if self.stopping.load(Ordering::SeqCst) {
            return Err(Response::error(409, "Dump Forge is stopping"));
        }
        if self.running.load(Ordering::SeqCst) > 0 {
            return Err(Response::error(
                409,
                format!(
                    "a conversion is queued or running; {} once it has finished",
                    if unpatch { "unpatch" } else { "patch" }
                ),
            ));
        }
        let done = if unpatch {
            ps5_dump_forge_core::lz4_unpatch(&arg.source)
        } else {
            ps5_dump_forge_core::lz4_patch(&arg.source)
        }
        .map_err(core)?;
        Ok(Response::json(&done))
    }

    /// Deletes a file or folder for good (core's `Jobs::delete_path`; the page asks first).
    /// Never a browse root or a folder holding one, configured or mounted now, nor anything an
    /// unfinished job uses. Admission is held, so no quit lands mid-delete.
    fn delete_path(&self, body: &[u8]) -> Reply {
        let arg: PathArg = parse(body)?;
        let _admission = lock(&self.admission);
        if self.stopping.load(Ordering::SeqCst) {
            return Err(Response::error(409, "Dump Forge is stopping"));
        }
        let mut keep = self.roots.current();
        keep.extend(self.opts.roots.iter().cloned());
        self.jobs.delete_path(&arg.path, &keep).map_err(|e| {
            let status = match e {
                DeleteError::Refused(_) => 400,
                DeleteError::Missing(_) => 404,
                DeleteError::Busy(_) => 409,
                DeleteError::Failed(_) => 500,
            };
            Response::error(status, e.to_string())
        })?;
        Ok(Response::json(&()))
    }

    /// `GET ?source=<path>` (percent-encoded): both LZ4 trace files at the root of a folder or
    /// image as one STORED zip, streamed (core's `Lz4Traces::write_zip`). Opening reads the
    /// source's metadata, so it counts as an inspection; the transfer doesn't. Jobs may run
    /// meanwhile: this only reads. A source that changes part way ends the body short.
    fn lz4_traces(&self, query: &str) -> Reply {
        let Some(source) = http::query_value(query, "source").filter(|v| !v.is_empty()) else {
            return Err(Response::error(
                400,
                "bad request: needs source=, percent-encoded",
            ));
        };
        let source = PathBuf::from(source);
        readable(&source)?;
        let mut traces = self
            .capped(|| ps5_dump_forge_core::lz4_traces(&source))?
            .map_err(|missing| Response::error(404, missing))?;
        let (name, len) = (traces.zip_name().to_string(), traces.zip_len());
        let body = Box::new(move |out: &mut dyn std::io::Write| traces.write_zip(out));
        Ok(Response::download("application/zip", &name, len, body))
    }

    /// Leftover `.part` files in `dirs` (missing ones skip), each
    /// folder listed once, without the ones unfinished jobs are writing; the first 1,000 by
    /// path. Matches as core's `stale_parts` does, but keeps only what it returns while listing.
    fn stale_parts(&self, body: &[u8]) -> Reply {
        // Room for the `.part`s of every unfinished job, taken out below.
        let keep = STALE_MAX + MAX_JOBS as usize;
        let mut seen = Vec::new();
        let mut found = BTreeSet::new();
        for dir in parse::<DirsArg>(body)?
            .dirs
            .into_iter()
            .filter(|d| !d.as_os_str().is_empty())
        {
            let key = dir.canonicalize().unwrap_or(dir);
            if seen.contains(&key) {
                continue;
            }
            for entry in std::fs::read_dir(&key).into_iter().flatten().flatten() {
                let path = entry.path();
                if path
                    .extension()
                    .is_some_and(|e| e.eq_ignore_ascii_case("part"))
                {
                    found.insert(path);
                    if found.len() > keep {
                        found.pop_last();
                    }
                }
            }
            seen.push(key);
        }
        // After the listing and under admission: a job whose `.part` was listed was started
        // before this, so it is in the table by now.
        let running = {
            let _admission = lock(&self.admission);
            lock(&self.table).unfinished()
        };
        let theirs = table::running_parts(&running);
        let parts: Vec<PathBuf> = found
            .into_iter()
            .filter(|p| !theirs.contains(p))
            .take(STALE_MAX)
            .collect();
        Ok(Response::json(&parts))
    }

    /// Any folder; `null` lists the roots. At most 10,000 entries (`truncated` says so).
    fn list_dir(&self, body: &[u8]) -> Reply {
        let roots = self.roots.current();
        let Some(path) = parse::<ListArg>(body)?.path else {
            let entries: Vec<_> = roots
                .iter()
                .filter_map(|r| r.to_str())
                .map(|r| json!({ "name": r, "path": r, "dir": true, "size": null }))
                .collect();
            return Ok(Response::json(&json!({
                "path": null, "parent": null, "entries": entries, "truncated": false,
            })));
        };
        let failed = |e: std::io::Error| Response::error(500, format!("{path}: {e}"));
        let dir = PathBuf::from(&path).canonicalize().map_err(failed)?;
        let mut entries = Vec::new();
        let mut truncated = false;
        // ponytail: a truncated listing is the first 10,000 the folder yields, sorted, not the
        // first 10,000 by name.
        for entry in std::fs::read_dir(&dir).map_err(failed)?.flatten() {
            let Ok(name) = entry.file_name().into_string() else {
                continue;
            };
            if entries.len() == LIST_MAX {
                truncated = true;
                break;
            }
            let mut full = dir.join(&name);
            // Symlinks are followed and come back resolved; a dangling one shows as itself.
            let meta = match std::fs::metadata(&full) {
                Ok(meta) => {
                    if entry.file_type().is_ok_and(|t| t.is_symlink()) {
                        full = full.canonicalize().unwrap_or(full);
                    }
                    Ok(meta)
                }
                Err(_) => entry.metadata(),
            };
            let Ok(meta) = meta else {
                continue;
            };
            entries.push((meta.is_dir(), name, full, meta.len()));
        }
        entries.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1)));
        let entries: Vec<_> = entries
            .into_iter()
            .map(|(dir, name, full, len)| {
                json!({ "name": name, "path": full, "dir": dir, "size": (!dir).then_some(len) })
            })
            .collect();
        let parent = match roots.contains(&dir) {
            true => None,
            false => dir.parent().map(PathBuf::from),
        };
        Ok(Response::json(&json!({
            "path": dir, "parent": parent, "entries": entries, "truncated": truncated,
        })))
    }

    /// Closes admission at once; once `{}` is sent, cancels every job, waits for its
    /// cleanup and exits. Repeated: `{}` and nothing more.
    fn quit(self: &Arc<Self>) -> Response {
        let mut response = Response::json(&json!({}));
        if self.stop() {
            let server = self.clone();
            response.after = Some(Box::new(move || server.finish()));
        }
        response
    }

    /// `true` for the call that closed admission. Once it returns, every admitted job is
    /// in the table.
    pub fn stop(&self) -> bool {
        let _admission = lock(&self.admission);
        !self.stopping.swap(true, Ordering::SeqCst)
    }

    pub fn finish(&self) {
        self.jobs.cancel_all_and_wait();
        #[cfg(target_env = "ps5")]
        crate::self_copy::wait();
        (self.opts.notify)(crate::notice::stopped(crate::notice::console_lang()));
        (self.opts.exit)(0);
    }
}

/// Dark modules on white with a 2-module quiet zone (the page pads it further); one path,
/// crisp edges, scaled by CSS.
fn qr_svg(code: &qrcode::QrCode) -> String {
    let (w, q) = (code.width(), 2);
    let mut d = String::new();
    for (i, c) in code.to_colors().iter().enumerate() {
        if *c == qrcode::Color::Dark {
            d += &format!("M{},{}h1v1h-1z", i % w + q, i / w + q);
        }
    }
    let n = w + 2 * q;
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {n} {n}\" shape-rendering=\"crispEdges\">\
         <rect width=\"{n}\" height=\"{n}\" fill=\"#fff\"/><path fill=\"#000\" d=\"{d}\"/></svg>"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    fn server() -> Server {
        let opts = Options::new(0, vec![std::env::temp_dir()], Platform::Host, |_: &str| {});
        Server::new(opts, "127.0.0.1:1".parse().unwrap()).unwrap()
    }

    fn post(server: &Arc<Server>, route: &str, body: serde_json::Value) -> Response {
        let head = format!("POST /api/{route} HTTP/1.1\r\nHost: x");
        let head = http::parse_head(head.as_bytes()).unwrap_or_else(|_| unreachable!());
        server
            .route(&head, body.to_string().as_bytes())
            .unwrap_or_else(|r| r)
    }

    /// Until a `start_job` on another thread holds admission (in its test pause). A fixed sleep
    /// raced it on a loaded CI runner: the thread could still be on its way in, or past it.
    fn wait_admitting(server: &Server) {
        let start = Instant::now();
        while !matches!(
            server.admission.try_lock(),
            Err(std::sync::TryLockError::WouldBlock)
        ) {
            assert!(
                start.elapsed() < Duration::from_secs(10),
                "start_job never got in"
            );
            std::thread::sleep(Duration::from_millis(1));
        }
    }

    // Only the Unix-only admission test needs a folder.
    #[cfg(unix)]
    fn dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("forge-api-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir.canonicalize().unwrap()
    }

    fn library_server(root: &Path) -> Arc<Server> {
        let opts = Options::new(0, vec![root.to_path_buf()], Platform::Host, |_: &str| {});
        Arc::new(Server::new(opts, "127.0.0.1:1".parse().unwrap()).unwrap())
    }

    /// Scan and cover: shapes, the configured roots, malformed bodies, the 2-at-once cap,
    /// stopping, a missing cover (`null`) and an unreadable source (core's message, 500).
    #[test]
    fn library() {
        // Under the build folder, not the temp dir: a macOS temp dir is a refused system folder.
        let root = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../target")
            .join(format!("forge-api-lib-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("plain")).unwrap();
        let root = root.canonicalize().unwrap();
        let server = library_server(&root);

        // A computer has no automatic scan: no root is a 400; a system folder is refused.
        let r = post(&server, "library_scan", json!({}));
        assert_eq!(
            (r.status, r.text().contains("choose a folder to scan")),
            (400, true)
        );
        // FreeBSD (the PS5) has no system-folder list.
        if cfg!(any(target_os = "macos", target_os = "linux", windows)) {
            // Windows refuses only the system drive's root; "/" is the current drive's (D:\ on
            // GitHub's runners), which is allowed.
            let system_root = match cfg!(windows) {
                true => {
                    let drive = std::env::var("SystemDrive").ok();
                    let letter = drive.and_then(|d| d.chars().next()).unwrap_or('C');
                    format!("{letter}:\\")
                }
                false => "/".to_string(),
            };
            let r = post(&server, "library_scan", json!({ "root": system_root }));
            assert_eq!(r.status, 500, "{}", r.text());
            assert!(r.text().contains("system folder"), "{}", r.text());
        }

        let r = post(&server, "library_scan", json!({ "root": root }));
        assert_eq!(r.status, 200, "{}", r.text());
        let v: serde_json::Value = serde_json::from_str(&r.text()).unwrap();
        assert_eq!(v["roots"], json!([root]));
        assert_eq!(v["entries"], json!([]));
        // A computer's reply has no free space.
        assert!(v.get("storage").is_none(), "{v}");
        assert_eq!(
            (&v["truncated"], &v["warnings"]),
            (&json!(false), &json!([]))
        );

        // Another root; a non-string root is a 400.
        let other = root.join("other");
        std::fs::create_dir_all(other.join("game/sce_sys")).unwrap();
        std::fs::write(other.join("game/eboot.bin"), b"x").unwrap();
        std::fs::write(
            other.join("game/sce_sys/param.json"),
            br#"{"titleId":"PPSA00001","contentVersion":"01.000.000"}"#,
        )
        .unwrap();
        let r = post(&server, "library_scan", json!({ "root": other }));
        assert_eq!(r.status, 200, "{}", r.text());
        let v: serde_json::Value = serde_json::from_str(&r.text()).unwrap();
        assert_eq!(v["roots"], json!([other]));
        assert_eq!(v["entries"][0]["title_id"], json!("PPSA00001"), "{v}");
        assert_eq!(v["entries"][0]["lz4_packed"], json!(false), "{v}");
        assert_eq!(v["entries"].as_array().unwrap().len(), 1);
        assert_eq!(
            post(&server, "library_scan", json!({ "root": 5 })).status,
            400
        );

        // A folder with no icon: `null`. A missing path: core's error.
        let r = post(
            &server,
            "library_cover",
            json!({ "path": root.join("plain") }),
        );
        assert_eq!((r.status, r.text()), (200, "null".to_string()));
        let gone = root.join("gone.ffpkg");
        let r = post(&server, "library_cover", json!({ "path": gone }));
        assert_eq!(r.status, 500);
        let v: serde_json::Value = serde_json::from_str(&r.text()).unwrap();
        assert!(
            v["error"].as_str().is_some_and(|e| !e.is_empty()),
            "{}",
            r.text()
        );

        // Bodies: not an object; no path.
        assert_eq!(post(&server, "library_scan", json!("x")).status, 400);
        assert_eq!(post(&server, "library_scan", json!([])).status, 400);
        assert_eq!(post(&server, "library_cover", json!({})).status, 400);
        assert_eq!(
            post(&server, "library_cover", json!({ "path": 1 })).status,
            400
        );

        server.inspecting.store(MAX_INSPECTIONS, Ordering::SeqCst);
        for (route, body) in [
            ("library_scan", json!({ "root": root })),
            ("library_cover", json!({ "path": root })),
        ] {
            let r = post(&server, route, body);
            assert_eq!((r.status, r.retry_after), (429, Some(1)), "{route}");
        }
        server.inspecting.store(0, Ordering::SeqCst);

        assert!(server.stop());
        for (route, body) in [
            ("library_scan", json!({ "root": root })),
            ("library_cover", json!({ "path": root })),
        ] {
            let r = post(&server, route, body);
            assert_eq!(r.status, 409, "{route}");
            assert!(r.text().contains("stopping"), "{}", r.text());
        }
        std::fs::remove_dir_all(&root).unwrap();
    }

    /// No patch or unpatch while a job is queued or running, or once stopping.
    #[test]
    fn lz4_patch_waits_for_jobs() {
        for (route, verb) in [("lz4_patch", "patch"), ("lz4_unpatch", "unpatch")] {
            let server = Arc::new(server());
            let body = json!({ "source": "/nonexistent/game" });
            server.running.store(1, Ordering::SeqCst);
            let r = post(&server, route, body.clone());
            assert_eq!(r.status, 409);
            assert!(
                r.text()
                    .contains(&format!("a conversion is queued or running; {verb} once")),
                "{}",
                r.text()
            );
            server.running.store(0, Ordering::SeqCst);
            // Through to core, which finds no folder.
            assert_eq!(post(&server, route, body.clone()).status, 500);
            assert!(server.stop());
            assert_eq!(post(&server, route, body).status, 409);
        }
    }

    /// Admission is held until a job is in the table, and both `stop` and `stale_parts`
    /// wait for it, though core's events can come first. A job queued behind one blocked on
    /// a FIFO stays unfinished; its `.part` (made here, as a worker would) is not stale.
    #[cfg(unix)]
    #[test]
    fn admission_is_seen_whole() {
        let tmp = dir("admit");
        let fifo = tmp.join("block.ffpfs");
        let c = std::ffi::CString::new(fifo.to_str().unwrap()).unwrap();
        // SAFETY: a NUL-terminated path.
        assert_eq!(unsafe { libc::mkfifo(c.as_ptr(), 0o600) }, 0);
        let mut server = server();
        server.admit_pause = Duration::from_millis(400);
        let server = Arc::new(server);
        // Job 1, past the API's source check: blocks opening the FIFO, holding the queue.
        server.jobs.start(ConvertRequest {
            source: fifo.clone(),
            format: Format::Exfat,
            output: tmp.join("blocked.exfat"),
            compression_threads: None,
            inner: None,
            remove_backport: false,
            full_verify: false,
            kraken_level: ps5_dump_forge_core::KrakenLevel::Fast,
            ffpfsc_level: 6,
            lz4: None,
            lz4_profile: None,
            lz4_traces: None,
            lz4_trace_space_mib: 256,
            lz4_in_place: false,
            archive_password: None,
        });
        let starter = {
            let (server, out) = (server.clone(), tmp.join("out.exfat"));
            std::thread::spawn(move || {
                let request = json!({ "request": {
                    "source": "/nonexistent/forge.exfat", "format": "exfat", "output": out,
                }});
                post(&server, "start_job", request).status
            })
        };
        wait_admitting(&server); // job 2 is inside the pause
        let pid = std::process::id();
        let live = tmp.join(format!("out.exfat.2-{pid}.part"));
        let old = tmp.join("old.exfat.1-1.part");
        std::fs::write(&live, b"").unwrap();
        std::fs::write(&old, b"").unwrap();
        let start = Instant::now();
        let r = post(&server, "stale_parts", json!({ "dirs": [tmp] }));
        // Job 2's `.part` isn't stale: `stale_parts` waited for its admission.
        assert_eq!(r.status, 200);
        assert_eq!(r.text(), json!([old]).to_string());
        // Nothing an unfinished job uses is deleted, nor a folder holding it; the rest is.
        for busy in [&live, &tmp] {
            let r = post(&server, "delete_path", json!({ "path": busy }));
            assert_eq!(r.status, 409, "{}", r.text());
        }
        let r = post(&server, "delete_path", json!({ "path": old }));
        assert_eq!((r.status, r.text()), (200, "null".to_string()));
        assert!(!old.exists() && live.exists());
        assert!(server.stop());
        let r = post(&server, "delete_path", json!({ "path": live }));
        assert_eq!(r.status, 409);
        assert!(r.text().contains("stopping"), "{}", r.text());
        assert!(
            lock(&server.table)
                .unfinished()
                .iter()
                .any(|(id, _)| *id == 2)
        );
        assert_eq!(starter.join().unwrap(), 200);

        server.jobs.cancel(2);
        // Opening the write end wakes job 1 to an empty file (non-blocking: it fails until
        // job 1 is waiting on its end).
        use std::os::unix::fs::OpenOptionsExt;
        let open = || {
            std::fs::OpenOptions::new()
                .write(true)
                .custom_flags(libc::O_NONBLOCK)
                .open(&fifo)
        };
        while open().is_err() {
            assert!(start.elapsed() < Duration::from_secs(10));
            std::thread::sleep(Duration::from_millis(20));
        }
        server.jobs.cancel_all_and_wait();
        std::fs::remove_dir_all(&tmp).unwrap();
    }

    /// The same without a blocked queue: a job whose `Done` came before `start` returned.
    #[test]
    fn stop_sees_every_admitted_job() {
        let mut server = server();
        server.admit_pause = Duration::from_millis(300);
        let server = Arc::new(server);
        let starter = {
            let server = server.clone();
            std::thread::spawn(move || {
                let body = json!({ "request": {
                    "source": "/nonexistent/forge.exfat", "format": "exfat",
                    "output": "/nonexistent/out.exfat",
                }});
                server.start_job(body.to_string().as_bytes()).is_ok()
            })
        };
        wait_admitting(&server); // inside the pause
        assert!(server.stop());
        assert!(lock(&server.table).all_admitted());
        assert_eq!(lock(&server.table).snapshot().len(), 1);
        assert!(starter.join().unwrap());
    }
}
