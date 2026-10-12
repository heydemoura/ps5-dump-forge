//! The app dir, where data stays next to the app (user decision 2026-10-06: no marker
//! file, no OS per-user fallback). The app keeps no settings: only WebView data lands here.

use std::path::{Path, PathBuf};

/// The folder the user sees the app in: the one holding the exe, except that an exe inside
/// `X.app/Contents/MacOS/` means the folder holding `X.app`, and an exe anywhere inside a
/// Linux `X.AppDir/` means the folder holding it (where `forge.sh` sits). Never the working
/// directory.
pub(crate) fn app_dir(exe: &Path) -> PathBuf {
    let dir = exe.parent().unwrap_or(Path::new(""));
    let appdir = dir.ancestors().find(|a| {
        a.extension()
            .is_some_and(|e| e.eq_ignore_ascii_case("appdir"))
    });
    if let Some(parent) = appdir.and_then(Path::parent) {
        return parent.to_path_buf();
    }
    let bundle = dir
        .parent()
        .filter(|_| dir.file_name().is_some_and(|n| n == "MacOS"))
        .filter(|contents| contents.file_name().is_some_and(|n| n == "Contents"))
        .and_then(Path::parent)
        .filter(|app| {
            app.extension()
                .is_some_and(|e| e.eq_ignore_ascii_case("app"))
        });
    match bundle.and_then(Path::parent) {
        Some(parent) => parent.to_path_buf(),
        None => dir.to_path_buf(),
    }
}
