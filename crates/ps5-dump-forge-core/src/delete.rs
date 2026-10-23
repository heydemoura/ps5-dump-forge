//! Deleting and moving what the user picked and confirmed ([`crate::Jobs::delete_path`],
//! [`crate::Jobs::move_path`]), both refused by one `check`: a file or a folder, never a link,
//! a special file, a filesystem root, a protected root or anything holding one, an interrupted
//! edit's undo journal while its image is there, nothing an unfinished job reads or writes,
//! and on the PS5 nothing at or in ShadowMount+'s mount folder, no image it has mounted and no
//! folder holding one (fails closed). Called with the job table locked, so no job is admitted
//! between the check and the change.

use std::io;
use std::path::{Component, Path, PathBuf};

use crate::finalize::{FileId, followed_id, fsync_dir, path_id};

/// Why a delete did not happen, or did not finish.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DeleteError {
    /// Not something Forge deletes: an empty path, a link, a special file, a root.
    Refused(String),
    /// Nothing at the path.
    Missing(String),
    /// An unfinished job reads or writes it, or a peer is writing it (inside or around it too).
    Busy(String),
    /// The removal or the folder sync failed; a folder may be partly deleted.
    Failed(String),
}

impl std::fmt::Display for DeleteError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let (Self::Refused(m) | Self::Missing(m) | Self::Busy(m) | Self::Failed(m)) = self;
        f.write_str(m)
    }
}

impl std::error::Error for DeleteError {}

/// What a delete or move source names, once [`check`] passed it.
struct Checked {
    /// As typed, rebuilt from its components.
    path: PathBuf,
    /// Canonical.
    real: PathBuf,
    id: FileId,
    kind: std::fs::FileType,
    /// ShadowMount+'s mount points before its checks, for [`smp_unchanged`] (PS5).
    #[cfg(target_os = "freebsd")]
    smp: Vec<PathBuf>,
}

/// Refuses `path` as something to `verb` ("delete", "move") unless it is a file or folder
/// that is no filesystem root, is not and holds none of `protected` and overlaps no path of
/// `guarded` (unfinished jobs' sources, outputs, `.part`s and inputs).
fn check<'a>(
    path: &Path,
    verb: &str,
    protected: &[PathBuf],
    guarded: impl IntoIterator<Item = &'a PathBuf>,
) -> Result<Checked, DeleteError> {
    if path.as_os_str().is_empty() {
        return Err(DeleteError::Refused(format!("no path to {verb}")));
    }
    // To the OS `link/` and `link/.` name the link's target, which the link check below would
    // never see; rebuilt from its components (no trailing `/` or `.`) the path names the link.
    let path = path.components().collect::<PathBuf>();
    let shown = path.display();
    let (id, kind) = match path_id(&path) {
        Ok(found) => found,
        Err(e) if e.kind() == io::ErrorKind::NotFound => {
            return Err(DeleteError::Missing(format!("{shown} does not exist")));
        }
        Err(e) => return Err(DeleteError::Failed(format!("reading {shown}: {e}"))),
    };
    if kind.is_symlink() {
        return Err(DeleteError::Refused(format!(
            "{shown} is a link; pick what it points at instead"
        )));
    }
    if !kind.is_file() && !kind.is_dir() {
        return Err(DeleteError::Refused(format!(
            "{shown} is not a file or folder"
        )));
    }
    let failed = |e: io::Error| DeleteError::Failed(format!("resolving {shown}: {e}"));
    let real = path.canonicalize().map_err(failed)?;
    // Gone or elsewhere, the journal could never restore its image (or would be replayed into
    // another one); Edit's open settles it.
    if let Some(image) =
        journal_image(&real).filter(|i| kind.is_file() && i.symlink_metadata().is_ok())
    {
        return Err(DeleteError::Refused(format!(
            "{shown} is the undo journal of an interrupted edit of {}; open that image in Edit, \
             which restores it",
            image.display()
        )));
    }
    // Taken before the checks below: SMP mounts on its own, so what it mounts after this is
    // caught by `smp_unchanged` just before the change.
    #[cfg(target_os = "freebsd")]
    let smp = smp_snapshot(
        &mut crate::edit_job::smp_list,
        &mut crate::edit_job::smp_is_mount,
    )?;
    #[cfg(target_os = "freebsd")]
    if let Some(why) = smp_refusal(
        &path,
        &real,
        kind.is_dir(),
        verb,
        &mut crate::edit_job::smp_list,
        &mut crate::edit_job::smp_is_mount,
        &mut find_image,
    ) {
        return Err(why);
    }
    let chain = ids_up(&real).map_err(failed)?;
    // A volume's root, or a folder another volume is mounted on.
    let root = match real.parent() {
        None => true,
        Some(parent) => followed_id(parent).map_err(failed)?.0 != id.0,
    };
    if root {
        return Err(DeleteError::Refused(format!(
            "{shown} is the root of a drive or volume"
        )));
    }
    for keep in protected {
        if holds(id, keep) {
            return Err(DeleteError::Refused(format!(
                "{shown} is, or holds, {}, which is not {verb}d",
                keep.display()
            )));
        }
    }
    for used in guarded {
        let inside = followed_id(used).is_ok_and(|g| chain.contains(&g));
        if inside || holds(id, used) {
            return Err(DeleteError::Busy(format!(
                "{shown} is in use by an unfinished job ({}); wait for it or stop it first",
                used.display()
            )));
        }
    }
    Ok(Checked {
        path,
        real,
        id,
        kind,
        #[cfg(target_os = "freebsd")]
        smp,
    })
}

/// Deletes `path` unless it overlaps a path of `guarded` (unfinished jobs' sources, outputs,
/// `.part`s and inputs) or is, or holds, a filesystem root or one of `protected`.
pub(crate) fn delete<'a>(
    path: &Path,
    protected: &[PathBuf],
    guarded: impl IntoIterator<Item = &'a PathBuf>,
) -> Result<(), DeleteError> {
    net_refusal(path)?;
    let Checked {
        path,
        real,
        id,
        kind,
        #[cfg(target_os = "freebsd")]
        smp,
    } = check(path, "delete", protected, guarded)?;
    let shown = path.display();
    let failed = |what: &str, e: io::Error| DeleteError::Failed(format!("{what} {shown}: {e}"));
    // remove_dir_all would empty a volume mounted somewhere inside before failing on it.
    #[cfg(unix)]
    if kind.is_dir()
        && let Some(mount) = mount_inside(&real, id.0).map_err(|e| failed("reading", e))?
    {
        return Err(DeleteError::Refused(format!(
            "{shown} holds {}, where another volume is mounted",
            mount.display()
        )));
    }
    // The checks above looked at what `path` named then; it must still be that.
    if !path_id(&real).is_ok_and(|(now, k)| now == id && k.is_dir() == kind.is_dir()) {
        return Err(DeleteError::Failed(format!(
            "{shown} changed while it was checked; nothing deleted"
        )));
    }
    // ponytail: an image SMP mounts while remove_dir_all runs is not caught; SMP has no lock
    // to hold it off.
    #[cfg(target_os = "freebsd")]
    smp_unchanged(
        &smp,
        &mut crate::edit_job::smp_list,
        &mut crate::edit_job::smp_is_mount,
        "deleted",
    )?;
    if kind.is_dir() {
        // std's remove_dir_all removes links inside without following them.
        if let Err(e) = std::fs::remove_dir_all(&real) {
            let partly = if real.exists() {
                "; some of it may already be gone"
            } else {
                ""
            };
            return Err(DeleteError::Failed(format!(
                "deleting {shown}: {e}{partly}"
            )));
        }
    } else {
        std::fs::remove_file(&real).map_err(|e| failed("deleting", e))?;
        // An interrupted edit's undo journal goes with its image: left behind, it would be
        // replayed into a later image of the same name.
        let journal = ps5_dump_forge_patch::journal_path(&real);
        if std::fs::symlink_metadata(&journal).is_ok_and(|m| !m.is_dir()) {
            std::fs::remove_file(&journal).map_err(|e| {
                DeleteError::Failed(format!(
                    "deleted {shown}, but not its undo journal {}: {e}",
                    journal.display()
                ))
            })?;
        }
    }
    if let Some(parent) = real.parent() {
        fsync_dir(parent).map_err(|e| {
            DeleteError::Failed(format!(
                "deleted {shown}, but syncing {} failed: {e}",
                parent.display()
            ))
        })?;
    }
    Ok(())
}

/// A NAS share or a peer is read only here: nothing on it is deleted or moved.
fn net_refusal(path: &Path) -> Result<(), DeleteError> {
    if crate::remote::is_nas(path) {
        return Err(DeleteError::Refused(format!(
            "{}: a NAS share is read only here; delete or move it on the NAS itself",
            path.display()
        )));
    }
    if crate::remote::is_remote(path) {
        return Err(DeleteError::Refused(format!(
            "{}: a file on another device is deleted or moved on that device itself",
            path.display()
        )));
    }
    Ok(())
}

/// Moves or renames `from` to `to` (a new name in an existing folder, never replacing
/// anything), refused as [`delete`] refuses `from`, and for a `to` inside `from`, on another
/// volume or at, in or above a path of `guarded`. An image with an interrupted edit's undo
/// journal beside it stays where its journal is.
pub(crate) fn move_<'a>(
    from: &Path,
    to: &Path,
    protected: &[PathBuf],
    guarded: impl IntoIterator<Item = &'a PathBuf>,
) -> Result<(), DeleteError> {
    net_refusal(from)?;
    net_refusal(to)?;
    let guarded: Vec<&PathBuf> = guarded.into_iter().collect();
    let Checked {
        path,
        real,
        id,
        kind,
        #[cfg(target_os = "freebsd")]
        smp,
    } = check(from, "move", protected, guarded.iter().copied())?;
    let shown = path.display();
    // A volume mounted inside would move with it (or fail half way); delete refuses it too.
    #[cfg(unix)]
    if kind.is_dir() {
        let failed = |e: io::Error| DeleteError::Failed(format!("reading {shown}: {e}"));
        if let Some(mount) = mount_inside(&real, id.0).map_err(failed)? {
            return Err(DeleteError::Refused(format!(
                "{shown} holds {}, where another volume is mounted",
                mount.display()
            )));
        }
    }
    let to = to.components().collect::<PathBuf>();
    let shown_to = to.display();
    let refused = |m: String| Err(DeleteError::Refused(m));
    let Some(Component::Normal(name)) = to.components().next_back() else {
        return refused(format!("{shown_to} does not end in a file or folder name"));
    };
    if name.to_str().is_some_and(|n| n.contains(['/', '\\'])) {
        return refused(format!("{shown_to}: a name can't hold / or \\"));
    }
    let parent = match to.parent() {
        Some(p) if !p.as_os_str().is_empty() => p,
        _ => Path::new("."),
    };
    let real_parent = match parent.canonicalize() {
        Ok(p) => p,
        Err(e) if e.kind() == io::ErrorKind::NotFound => {
            return Err(DeleteError::Missing(format!(
                "{} does not exist",
                parent.display()
            )));
        }
        Err(e) => {
            let m = format!("resolving {}: {e}", parent.display());
            return Err(DeleteError::Failed(m));
        }
    };
    // FreeBSD's realpath accepts a missing last component.
    match real_parent.metadata() {
        Ok(meta) if meta.is_dir() => {}
        Err(e) if e.kind() == io::ErrorKind::NotFound => {
            return Err(DeleteError::Missing(format!(
                "{} does not exist",
                parent.display()
            )));
        }
        _ => return refused(format!("{} is not a folder", parent.display())),
    }
    #[cfg(target_os = "freebsd")]
    if let Some(why) = smp_folder(&to, &real_parent.join(name)) {
        return Err(why);
    }
    let failed = |e: io::Error| DeleteError::Failed(format!("resolving {shown_to}: {e}"));
    let chain = ids_up(&real_parent).map_err(failed)?;
    if chain.contains(&id) {
        return refused(format!("{shown} can't be moved into itself ({shown_to})"));
    }
    if chain[0].0 != id.0 {
        return refused(format!(
            "can't move between drives; {shown_to} is on another drive or volume than {shown}"
        ));
    }
    let target = real_parent.join(name);
    // A case-only rename on a case-insensitive volume finds `from` itself at `to`; on a
    // case-sensitive one `to` can be another name (a hard link) of the same file, which the
    // folder then lists as its own entry: that one already exists.
    let recased = path_id(&target).is_ok_and(|(t, _)| t == id)
        && real.parent() == Some(&*real_parent)
        && real.file_name().is_some_and(|old| {
            old != name
                && old.to_string_lossy().to_lowercase() == name.to_string_lossy().to_lowercase()
        })
        && std::fs::read_dir(&real_parent)
            .map_err(|e| DeleteError::Failed(format!("reading {}: {e}", real_parent.display())))?
            .all(|e| e.is_ok_and(|e| e.file_name() != name));
    if !recased && target.symlink_metadata().is_ok() {
        return refused(format!("{shown_to} already exists; nothing is replaced"));
    }
    for used in &guarded {
        let inside = followed_id(used).is_ok_and(|g| chain.contains(&g));
        if inside || resolved(used).starts_with(&target) {
            return Err(DeleteError::Busy(format!(
                "{shown_to} is in use by an unfinished job ({}); wait for it or stop it first",
                used.display()
            )));
        }
    }
    // Left behind, the journal would be replayed into a later image of the old name; found at
    // the new one, into this image.
    let journal = ps5_dump_forge_patch::journal_path(&real);
    let journal_to = ps5_dump_forge_patch::journal_path(&target);
    if kind.is_file() && journal.symlink_metadata().is_ok() {
        return refused(format!(
            "an interrupted edit is pending on {shown}; open it in Edit first"
        ));
    }
    if let Some(image) = journal_image(&target).filter(|i| i.symlink_metadata().is_ok()) {
        return refused(format!(
            "{shown_to} would be taken for the undo journal of {}; choose another name",
            image.display()
        ));
    }
    if kind.is_file() && journal_to.symlink_metadata().is_ok() {
        return refused(format!(
            "{} is left at the new name; delete or move it first",
            journal_to.display()
        ));
    }
    // The checks above looked at what `from` named then; it must still be that.
    if !path_id(&real).is_ok_and(|(now, k)| now == id && k.is_dir() == kind.is_dir()) {
        return Err(DeleteError::Failed(format!(
            "{shown} changed while it was checked; nothing moved"
        )));
    }
    #[cfg(target_os = "freebsd")]
    smp_unchanged(
        &smp,
        &mut crate::edit_job::smp_list,
        &mut crate::edit_job::smp_is_mount,
        "moved",
    )?;
    let moved = if recased {
        std::fs::rename(&real, &target)
    } else {
        crate::finalize::rename_no_replace(&real, &target)
    };
    match moved {
        Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {
            return refused(format!("{shown_to} already exists; nothing is replaced"));
        }
        Err(e) if e.kind() == io::ErrorKind::CrossesDevices => {
            return refused(format!(
                "can't move between drives; {shown_to} is on another drive or volume than {shown}"
            ));
        }
        Err(e) => {
            let m = format!("moving {shown} to {shown_to}: {e}");
            return Err(DeleteError::Failed(m));
        }
        Ok(()) => {}
    }
    let mut dirs = vec![real_parent.as_path()];
    dirs.extend(real.parent().filter(|p| *p != real_parent));
    for dir in dirs {
        fsync_dir(dir).map_err(|e| {
            DeleteError::Failed(format!(
                "moved {shown} to {shown_to}, but syncing {} failed: {e}",
                dir.display()
            ))
        })?;
    }
    Ok(())
}

/// Refuses `path` (as typed and resolved, `real`) at or inside ShadowMount+'s mount folder
/// (PS5 only): what is there is a mounted game, not files.
#[cfg(any(target_os = "freebsd", test))]
fn smp_folder(path: &Path, real: &Path) -> Option<DeleteError> {
    use crate::library_roots::shadowmnt;
    (shadowmnt(path) || shadowmnt(real)).then(|| {
        DeleteError::Refused(format!(
            "{} is at or inside ShadowMount+'s mount folder; nothing changed",
            path.display()
        ))
    })
}

/// Looks under a folder for a file whose name the filter accepts ([`find_image`]).
#[cfg(any(target_os = "freebsd", test))]
type FindImage<'a> = dyn FnMut(&Path, &dyn Fn(&str) -> bool) -> io::Result<Option<PathBuf>> + 'a;

/// ShadowMount+'s part of [`check`] (PS5 only): nothing at or inside its mount folder
/// ([`smp_folder`]), no image it has mounted (`list`/`is_mount`:
/// [`crate::edit_job::smp_mounts`]) and, while it has any mounted, no folder holding an image
/// of a mounted stem (`find` walks the folder for one). Fails closed: what can't be read
/// refuses.
#[cfg(any(target_os = "freebsd", test))]
fn smp_refusal(
    path: &Path,
    real: &Path,
    dir: bool,
    verb: &str,
    list: &mut dyn FnMut(&Path) -> io::Result<Vec<String>>,
    is_mount: &mut dyn FnMut(&Path) -> io::Result<bool>,
    find: &mut FindImage<'_>,
) -> Option<DeleteError> {
    use crate::edit_job::{smp_mounts, smp_stem};
    if let Some(why) = smp_folder(path, real) {
        return Some(why);
    }
    let shown = path.display();
    let refused = |m: String| Some(DeleteError::Refused(m));
    let mounted = |image: &Path, at: &Path| {
        refused(format!(
            "ShadowMount+ has {} mounted at {}: stop the game and turn ShadowMount+ off, then \
             {verb} it; nothing changed",
            image.display(),
            at.display()
        ))
    };
    if !dir {
        let name = real.file_name()?;
        let Some(name) = name.to_str() else {
            // A name SMP's mount entry can't be matched with (they are read as UTF-8).
            return smp_stem(&name.to_string_lossy()).and_then(|_| {
                refused(format!(
                    "can't tell whether ShadowMount+ has {shown} mounted (its name is not \
                     UTF-8); nothing changed"
                ))
            });
        };
        let stem = smp_stem(name)?;
        return match smp_mounts(list, is_mount, &|s| s == stem) {
            Ok(found) => found.first().and_then(|(_, at)| mounted(path, at)),
            Err((at, e)) => refused(format!(
                "can't tell whether ShadowMount+ has {shown} mounted ({}: {e}); nothing changed",
                at.display()
            )),
        };
    }
    let found = match smp_mounts(list, is_mount, &|_| true) {
        Ok(found) => found,
        Err((at, e)) => {
            return refused(format!(
                "can't tell whether ShadowMount+ has an image in {shown} mounted ({}: {e}); \
                 nothing changed",
                at.display()
            ));
        }
    };
    if found.is_empty() {
        return None;
    }
    let held = |name: &str| smp_stem(name).is_some_and(|s| found.iter().any(|(m, _)| m == s));
    match find(real, &held) {
        Ok(None) => None,
        Ok(Some(image)) => {
            let name = image.file_name().and_then(|n| n.to_str()).unwrap_or("");
            let stem = smp_stem(name).unwrap_or(name);
            let at = found.iter().find(|(m, _)| m == stem).map(|(_, at)| at)?;
            mounted(&image, at)
        }
        Err(e) => refused(format!(
            "can't tell whether {shown} holds an image ShadowMount+ has mounted ({e}); nothing \
             changed"
        )),
    }
}

/// ShadowMount+'s mount points now (all stems); a listing error refuses (fails closed).
#[cfg(any(target_os = "freebsd", test))]
fn smp_snapshot(
    list: &mut dyn FnMut(&Path) -> io::Result<Vec<String>>,
    is_mount: &mut dyn FnMut(&Path) -> io::Result<bool>,
) -> Result<Vec<PathBuf>, DeleteError> {
    match crate::edit_job::smp_mounts(list, is_mount, &|_| true) {
        Ok(found) => Ok(found.into_iter().map(|(_, at)| at).collect()),
        Err((at, e)) => Err(DeleteError::Refused(format!(
            "can't tell what ShadowMount+ has mounted ({}: {e}); nothing changed",
            at.display()
        ))),
    }
}

/// Refuses when ShadowMount+ mounted something since `before` ([`smp_snapshot`]): the checks
/// in between could not have seen it. `done`: "deleted", "moved".
#[cfg(any(target_os = "freebsd", test))]
fn smp_unchanged(
    before: &[PathBuf],
    list: &mut dyn FnMut(&Path) -> io::Result<Vec<String>>,
    is_mount: &mut dyn FnMut(&Path) -> io::Result<bool>,
    done: &str,
) -> Result<(), DeleteError> {
    match smp_snapshot(list, is_mount)?
        .iter()
        .find(|m| !before.contains(m))
    {
        None => Ok(()),
        Some(m) => Err(DeleteError::Refused(format!(
            "ShadowMount+ mounted {} while this was checked; nothing {done}, try again",
            m.display()
        ))),
    }
}

/// At most this many entries [`find_image`] looks through before it gives up (an error).
#[cfg(any(target_os = "freebsd", test))]
const FIND_MAX: usize = 200_000;

/// The first file under `dir` (links not followed) whose name `wanted` accepts.
#[cfg(any(target_os = "freebsd", test))]
fn find_image(dir: &Path, wanted: &dyn Fn(&str) -> bool) -> io::Result<Option<PathBuf>> {
    let mut todo = vec![dir.to_path_buf()];
    let mut seen = 0;
    while let Some(dir) = todo.pop() {
        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            seen += 1;
            if seen > FIND_MAX {
                return Err(io::Error::other(format!(
                    "more than {FIND_MAX} entries to look through"
                )));
            }
            let kind = entry.file_type()?;
            if kind.is_dir() {
                todo.push(entry.path());
            } else if kind.is_file() {
                // Skipped, a mounted image with such a name would pass unseen.
                let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
                    let shown = entry.path().display().to_string();
                    let e = format!("{shown}: a name that is not UTF-8");
                    return Err(io::Error::new(io::ErrorKind::InvalidData, e));
                };
                if wanted(&name) {
                    return Ok(Some(entry.path()));
                }
            }
        }
    }
    Ok(None)
}

/// `path` with its longest existing ancestor resolved and the rest as written.
fn resolved(path: &Path) -> PathBuf {
    for above in path.ancestors().filter(|p| !p.as_os_str().is_empty()) {
        if let Ok(real) = above.canonicalize() {
            return real.join(path.strip_prefix(above).unwrap_or(Path::new("")));
        }
    }
    path.to_path_buf()
}

/// Whether `path` is at, in or above one of `guarded`, compared as [`delete`] compares them
/// (by identity, links on the typed path included); a path that doesn't exist yet as
/// [`new_in_use`] judges it. A path on a peer or a NAS is compared with the guarded paths on
/// that device as [`FlinkPath::within`] compares them (the device judges identity there),
/// never with local ones.
pub(crate) fn in_use<'a>(path: &Path, guarded: impl IntoIterator<Item = &'a PathBuf>) -> bool {
    use crate::remote::FlinkPath;
    if crate::remote::is_remote(path) {
        let Ok(at) = FlinkPath::parse(path) else {
            return false;
        };
        // Scheme and device checked, an SMB share's paths case-folded.
        return guarded
            .into_iter()
            .any(|g| FlinkPath::parse(g).is_ok_and(|g| at.within(&g) || g.within(&at)));
    }
    let path = &path.components().collect::<PathBuf>();
    let guarded = guarded.into_iter();
    let Ok((id, _)) = path_id(path) else {
        return new_in_use(path, guarded);
    };
    // A peer's or a NAS's path is never this computer's.
    let mut guarded = guarded.filter(|g| !crate::net::is_network(g));
    let chain = (path.canonicalize().and_then(|real| ids_up(&real))).unwrap_or_default();
    guarded.any(|used| followed_id(used).is_ok_and(|g| chain.contains(&g)) || holds(id, used))
}

/// [`in_use`] for a path that doesn't exist yet (a file or folder about to be made): at, in or
/// above a guarded path as spelled or with existing folders resolved (a link to a queued job's
/// output folder), or inside one by the identity of its nearest existing folder (a new file
/// in a job's source folder or `.part`).
fn new_in_use<'a>(path: &Path, mut guarded: impl Iterator<Item = &'a PathBuf>) -> bool {
    let real = resolved(path);
    let chain = (path.ancestors().skip(1))
        .filter(|p| !p.as_os_str().is_empty())
        .find_map(|p| p.canonicalize().ok())
        .and_then(|real| ids_up(&real).ok())
        .unwrap_or_default();
    guarded.any(|g| {
        let g: PathBuf = g.components().collect();
        if path.starts_with(&g) || g.starts_with(path) {
            return true;
        }
        if crate::net::is_network(&g) {
            return false;
        }
        let at = resolved(&g);
        real.starts_with(&at)
            || at.starts_with(&real)
            || followed_id(&g).is_ok_and(|g| chain.contains(&g))
    })
}

/// The image whose undo journal ([`ps5_dump_forge_patch::journal_path`]) `path` would be.
fn journal_image(path: &Path) -> Option<PathBuf> {
    let name = path.file_name()?.to_str()?.strip_suffix(".forge-undo")?;
    (!name.is_empty()).then(|| path.with_file_name(name))
}

/// The identities of `real` (canonical) and every folder above it.
fn ids_up(real: &Path) -> io::Result<Vec<FileId>> {
    real.ancestors().map(followed_id).collect()
}

/// The first folder under `dir` (links not followed) on another volume than `dev`.
#[cfg(unix)]
fn mount_inside(dir: &Path, dev: u64) -> io::Result<Option<PathBuf>> {
    use std::os::unix::fs::MetadataExt;
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let meta = entry.metadata()?;
        if !meta.is_dir() {
            continue;
        }
        if meta.dev() != dev {
            return Ok(Some(entry.path()));
        }
        if let Some(mount) = mount_inside(&entry.path(), dev)? {
            return Ok(Some(mount));
        }
    }
    Ok(None)
}

/// Whether `id` is `path` or a folder above it, as written (a link on the way counts, not
/// only what it points at) or resolved. A path that does not exist yet (a job's output) is
/// judged by its existing folders.
fn holds(id: FileId, path: &Path) -> bool {
    let mut found = false;
    for real in path
        .ancestors()
        .filter(|p| !p.as_os_str().is_empty())
        .filter_map(|p| p.canonicalize().ok())
    {
        found = true;
        if ids_up(&real).is_ok_and(|ids| ids.contains(&id)) {
            return true;
        }
    }
    !found
        && std::env::current_dir().is_ok_and(|cwd| ids_up(&cwd).is_ok_and(|ids| ids.contains(&id)))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// What `move_` refused, or "ok".
    fn moved(from: &Path, to: &Path, protected: &[PathBuf], guarded: &[PathBuf]) -> &'static str {
        match move_(from, to, protected, guarded) {
            Ok(()) => "ok",
            Err(DeleteError::Refused(_)) => "refused",
            Err(DeleteError::Missing(_)) => "missing",
            Err(DeleteError::Busy(_)) => "busy",
            Err(DeleteError::Failed(e)) => panic!("{} -> {}: {e}", from.display(), to.display()),
        }
    }

    #[test]
    fn move_renames_in_place_and_into_another_folder() {
        let dir = crate::test_dir("move");
        std::fs::create_dir_all(dir.join("game/sce_sys")).unwrap();
        std::fs::create_dir_all(dir.join("other")).unwrap();
        std::fs::write(dir.join("game/sce_sys/param.json"), b"{}").unwrap();
        std::fs::write(dir.join("a.exfat"), b"img").unwrap();
        assert_eq!(
            moved(&dir.join("a.exfat"), &dir.join("b.exfat"), &[], &[]),
            "ok"
        );
        assert!(!dir.join("a.exfat").exists());
        assert_eq!(std::fs::read(dir.join("b.exfat")).unwrap(), b"img");
        assert_eq!(
            moved(&dir.join("game"), &dir.join("other/game2"), &[], &[]),
            "ok"
        );
        assert!(dir.join("other/game2/sce_sys/param.json").is_file());
        assert!(!dir.join("game").exists());
        // A case-only rename, on a case-insensitive volume too.
        assert_eq!(
            moved(&dir.join("b.exfat"), &dir.join("B.exfat"), &[], &[]),
            "ok"
        );
        let names: Vec<_> = (std::fs::read_dir(&dir).unwrap().flatten())
            .map(|e| e.file_name().into_string().unwrap())
            .collect();
        assert!(names.contains(&"B.exfat".to_string()), "{names:?}");
        assert!(!names.contains(&"b.exfat".to_string()), "{names:?}");
        // Inside a protected root is what moving is for.
        let keep = [dir.join("other")];
        let to = dir.join("other/game3");
        assert_eq!(moved(&dir.join("other/game2"), &to, &keep, &[]), "ok");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn move_refuses_what_it_must_not_move_or_replace() {
        let dir = crate::test_dir("move-refused");
        std::fs::create_dir_all(dir.join("game/data")).unwrap();
        std::fs::create_dir_all(dir.join("games/a")).unwrap();
        std::fs::write(dir.join("x.bin"), b"x").unwrap();
        std::fs::write(dir.join("y.bin"), b"y").unwrap();
        let x = dir.join("x.bin");
        // Never replaced, never into itself.
        assert_eq!(moved(&x, &dir.join("y.bin"), &[], &[]), "refused");
        assert_eq!(std::fs::read(dir.join("y.bin")).unwrap(), b"y");
        assert_eq!(moved(&x, &x, &[], &[]), "refused");
        let game = dir.join("game");
        assert_eq!(moved(&game, &game.join("data/game"), &[], &[]), "refused");
        assert_eq!(moved(&game, &game.join("inner"), &[], &[]), "refused");
        // Not there, or nowhere to go.
        assert_eq!(
            moved(&dir.join("none"), &dir.join("z"), &[], &[]),
            "missing"
        );
        assert_eq!(moved(&x, &dir.join("none/x.bin"), &[], &[]), "missing");
        assert_eq!(moved(&x, &dir.join("y.bin/x.bin"), &[], &[]), "refused");
        // Bad target names: none, `..`, a backslash.
        for to in [PathBuf::new(), dir.join("game/.."), dir.join("a\\b")] {
            #[cfg(windows)]
            if to.ends_with("a\\b") {
                continue;
            }
            assert_eq!(moved(&x, &to, &[], &[]), "refused", "{}", to.display());
        }
        assert_eq!(moved(Path::new(""), &dir.join("z"), &[], &[]), "refused");
        // A root, a protected root and what holds it.
        let top = dir.ancestors().last().unwrap();
        assert_eq!(moved(top, &dir.join("z"), &[], &[]), "refused");
        let keep = [dir.join("games")];
        assert_eq!(
            moved(&dir.join("games"), &dir.join("g2"), &keep, &[]),
            "refused"
        );
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&game, dir.join("link")).unwrap();
            assert_eq!(
                moved(&dir.join("link"), &dir.join("l2"), &[], &[]),
                "refused"
            );
            let fifo = std::ffi::CString::new(dir.join("fifo").to_str().unwrap()).unwrap();
            // SAFETY: a valid C string.
            assert_eq!(unsafe { libc::mkfifo(fifo.as_ptr(), 0o644) }, 0);
            assert_eq!(
                moved(&dir.join("fifo"), &dir.join("f2"), &[], &[]),
                "refused"
            );
        }
        assert!(x.is_file() && game.join("data").is_dir() && dir.join("games/a").is_dir());
        let _ = std::fs::remove_dir_all(dir);
    }

    /// Nothing an unfinished job uses is moved, nor anything around it, and nothing is moved
    /// to where a job reads or writes.
    #[test]
    fn move_leaves_what_unfinished_jobs_use() {
        let dir = crate::test_dir("move-busy");
        std::fs::create_dir_all(dir.join("src/data")).unwrap();
        std::fs::create_dir_all(dir.join("free")).unwrap();
        std::fs::write(dir.join("loose.bin"), b"l").unwrap();
        // A job's source and its output, not written yet.
        let guarded = [dir.join("src"), dir.join("out/game.ffpkg")];
        let loose = dir.join("loose.bin");
        for from in [dir.join("src"), dir.join("src/data"), dir.clone()] {
            let to = dir.join("free/moved");
            assert_eq!(
                moved(&from, &to, &[], &guarded),
                "busy",
                "{}",
                from.display()
            );
        }
        for to in [
            dir.join("src/loose.bin"),
            dir.join("src/data/loose.bin"),
            dir.join("out"),
            dir.join("out/game.ffpkg"),
        ] {
            if let Some(parent) = to.parent() {
                std::fs::create_dir_all(parent).unwrap();
            }
            assert_eq!(
                moved(&loose, &to, &[], &guarded),
                "busy",
                "{}",
                to.display()
            );
        }
        assert!(loose.is_file());
        assert_eq!(
            moved(&loose, &dir.join("free/loose.bin"), &[], &guarded),
            "ok"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    /// An image with an interrupted edit's journal stays with it, and no image is moved to a
    /// name a journal is left at.
    #[test]
    fn move_keeps_an_image_with_its_undo_journal() {
        let dir = crate::test_dir("move-journal");
        let image = dir.join("game.ffpkg");
        std::fs::write(&image, b"img").unwrap();
        let journal = ps5_dump_forge_patch::journal_path(&image);
        std::fs::write(&journal, b"FORGEUNDO1").unwrap();
        assert_eq!(moved(&image, &dir.join("new.ffpkg"), &[], &[]), "refused");
        assert!(image.is_file());
        // Nor the journal, while its image is there: not moved, renamed or deleted.
        assert_eq!(
            moved(&journal, &dir.join("other.ffpkg.forge-undo"), &[], &[]),
            "refused"
        );
        assert_eq!(
            moved(&journal, &dir.join("sub.forge-undo"), &[], &[]),
            "refused"
        );
        let none: [PathBuf; 0] = [];
        assert!(matches!(
            delete(&journal, &[], &none),
            Err(DeleteError::Refused(_))
        ));
        assert!(journal.is_file());
        // Nothing takes a journal's name beside an image.
        let other = dir.join("other.ffpkg");
        std::fs::write(&other, b"img2").unwrap();
        std::fs::write(dir.join("loose.bin"), b"x").unwrap();
        let taken = dir.join("other.ffpkg.forge-undo");
        assert_eq!(moved(&dir.join("loose.bin"), &taken, &[], &[]), "refused");
        std::fs::remove_file(&other).unwrap();
        std::fs::rename(&journal, dir.join("left.ffpkg.forge-undo")).unwrap();
        assert_eq!(moved(&image, &dir.join("left.ffpkg"), &[], &[]), "refused");
        assert_eq!(moved(&image, &dir.join("new.ffpkg"), &[], &[]), "ok");
        // A journal without its image is a plain file.
        let stray = dir.join("left.ffpkg.forge-undo");
        assert!(delete(&stray, &[], &none).is_ok());
        let _ = std::fs::remove_dir_all(dir);
    }

    /// What ShadowMount+ mounts between the checks and the change refuses; what was already
    /// mounted (and passed the checks) does not, and an unreadable mount folder fails closed.
    #[test]
    fn a_mount_made_while_checking_refuses() {
        let listing = |names: &'static [&'static str]| {
            move |d: &Path| -> io::Result<Vec<String>> {
                match d.to_str() {
                    Some("/mnt/shadowmnt") => Ok(names.iter().map(|n| n.to_string()).collect()),
                    _ => Err(io::ErrorKind::NotFound.into()),
                }
            }
        };
        let is_mount = &mut |_: &Path| -> io::Result<bool> { Ok(true) };
        let before = smp_snapshot(&mut listing(&["A_0a1b2c3d"]), is_mount).unwrap();
        assert_eq!(before.len(), 1);
        let same = &mut listing(&["A_0a1b2c3d"]);
        assert!(smp_unchanged(&before, same, is_mount, "deleted").is_ok());
        let gone = &mut listing(&[]);
        assert!(smp_unchanged(&before, gone, is_mount, "deleted").is_ok());
        let more = &mut listing(&["A_0a1b2c3d", "B_00000000"]);
        match smp_unchanged(&before, more, is_mount, "moved") {
            Err(DeleteError::Refused(m)) => {
                let m = m.replace('\\', "/");
                assert!(m.contains("mounted /mnt/shadowmnt/B_00000000 while"), "{m}");
                assert!(m.contains("nothing moved"), "{m}");
            }
            other => panic!("{other:?}"),
        }
        let denied = &mut |_: &Path| -> io::Result<Vec<String>> {
            Err(io::ErrorKind::PermissionDenied.into())
        };
        assert!(matches!(
            smp_unchanged(&before, denied, is_mount, "deleted"),
            Err(DeleteError::Refused(_))
        ));
    }

    #[test]
    fn shadowmount_paths_and_mounted_images_are_refused() {
        let dir = crate::test_dir("delete-smp");
        std::fs::create_dir_all(dir.join("games/deep")).unwrap();
        std::fs::write(dir.join("games/deep/My Game.FFPKG"), b"img").unwrap();
        std::fs::write(dir.join("games/Other.exfat"), b"img").unwrap();
        let real = dir.canonicalize().unwrap();
        let mounted = |names: &'static [&'static str]| {
            move |d: &Path| -> io::Result<Vec<String>> {
                match d.to_str() {
                    Some("/mnt/shadowmnt") => Ok(names.iter().map(|n| n.to_string()).collect()),
                    _ => Err(io::ErrorKind::NotFound.into()),
                }
            }
        };
        let is_mount = &mut |_: &Path| -> io::Result<bool> { Ok(true) };
        let walks = std::cell::Cell::new(0);
        let find = &mut |d: &Path, w: &dyn Fn(&str) -> bool| {
            walks.set(walks.get() + 1);
            find_image(d, w)
        };
        // Joined with the OS separator: `\` on Windows.
        let message = |r: Option<DeleteError>| match r {
            Some(DeleteError::Refused(m)) => m.replace('\\', "/"),
            other => panic!("{other:?}"),
        };
        let image = real.join("games/deep/My Game.FFPKG");
        let got = message(smp_refusal(
            &image,
            &image,
            false,
            "delete",
            &mut mounted(&["My Game_0a1b2c3d"]),
            is_mount,
            find,
        ));
        assert!(got.starts_with("ShadowMount+ has "), "{got}");
        assert!(
            got.contains("My Game.FFPKG mounted at /mnt/shadowmnt/My Game_0a1b2c3d: stop the game"),
            "{got}"
        );
        assert!(got.ends_with("then delete it; nothing changed"), "{got}");
        let other = real.join("games/Other.exfat");
        let list = &mut mounted(&["My Game_0a1b2c3d"]);
        assert_eq!(
            smp_refusal(&other, &other, false, "move", list, is_mount, find),
            None
        );
        // A folder holding one, however deep.
        let games = real.join("games");
        let got = message(smp_refusal(
            &games, &games, true, "move", list, is_mount, find,
        ));
        assert!(got.contains("deep/My Game.FFPKG mounted at"), "{got}");
        assert!(got.ends_with("then move it; nothing changed"), "{got}");
        assert_eq!(walks.get(), 1);
        // Mounts of other stems: walked, nothing found.
        let list = &mut mounted(&["Third_0a1b2c3d"]);
        assert_eq!(
            smp_refusal(&games, &games, true, "delete", list, is_mount, find),
            None
        );
        assert_eq!(walks.get(), 2);
        // No mounts: no walk.
        let none = &mut mounted(&[]);
        assert_eq!(
            smp_refusal(&games, &games, true, "delete", none, is_mount, find),
            None
        );
        let unmounted = &mut |_: &Path| -> io::Result<bool> { Ok(false) };
        let list = &mut mounted(&["My Game_0a1b2c3d"]);
        assert_eq!(
            smp_refusal(&games, &games, true, "delete", list, unmounted, find),
            None
        );
        assert_eq!(
            smp_refusal(&image, &image, false, "delete", list, unmounted, find),
            None
        );
        assert_eq!(walks.get(), 2);
        // Fails closed: mounts that can't be listed or stat'ed, a walk that fails.
        let denied = &mut |_: &Path| -> io::Result<Vec<String>> {
            Err(io::ErrorKind::PermissionDenied.into())
        };
        let got = message(smp_refusal(
            &image, &image, false, "delete", denied, is_mount, find,
        ));
        assert!(
            got.starts_with("can't tell whether ShadowMount+ has "),
            "{got}"
        );
        let got = message(smp_refusal(
            &games, &games, true, "delete", denied, is_mount, find,
        ));
        assert!(
            got.starts_with("can't tell whether ShadowMount+ has an image in "),
            "{got}"
        );
        let stat =
            &mut |_: &Path| -> io::Result<bool> { Err(io::ErrorKind::PermissionDenied.into()) };
        assert!(smp_refusal(&image, &image, false, "delete", list, stat, find).is_some());
        let broken = &mut |_: &Path, _: &dyn Fn(&str) -> bool| -> io::Result<Option<PathBuf>> {
            Err(io::Error::other("walk failed"))
        };
        let got = message(smp_refusal(
            &games, &games, true, "delete", list, is_mount, broken,
        ));
        assert!(
            got.starts_with("can't tell whether ") && got.contains("walk failed"),
            "{got}"
        );
        // ShadowMount+'s folder itself, as typed or resolved, source or target.
        for at in [
            "/mnt/shadowmnt",
            "/mnt/shadowmnt/My Game_0a1b2c3d",
            "/mnt/shadowmnt/pfsc/x",
        ] {
            let got = message(smp_refusal(
                Path::new(at),
                &games,
                true,
                "delete",
                none,
                is_mount,
                find,
            ));
            assert!(
                got.ends_with("is at or inside ShadowMount+'s mount folder; nothing changed"),
                "{got}"
            );
            assert!(smp_folder(&games, Path::new(at)).is_some());
        }
        assert_eq!(smp_folder(&games, &games), None);
        assert_eq!(smp_folder(Path::new("/mnt/shadowmnt2"), &games), None);
        let _ = std::fs::remove_dir_all(dir);
    }

    /// A path not made yet is in use inside a used folder, and at a used path that doesn't
    /// exist yet reached through a link.
    #[cfg(unix)]
    #[test]
    fn a_new_path_is_judged_by_its_folders() {
        let dir = crate::test_dir("in-use-new");
        std::fs::create_dir_all(dir.join("real")).unwrap();
        std::fs::create_dir_all(dir.join("game")).unwrap();
        std::os::unix::fs::symlink(dir.join("real"), dir.join("alias")).unwrap();
        let guarded = [dir.join("alias/new.exfat"), dir.join("game")];
        assert!(in_use(&dir.join("real/new.exfat"), &guarded));
        assert!(in_use(&dir.join("game/new/file"), &guarded));
        assert!(!in_use(&dir.join("real/other.exfat"), &guarded));
        assert!(!in_use(&dir.join("gamer"), &guarded));
        let _ = std::fs::remove_dir_all(dir);
    }
}
