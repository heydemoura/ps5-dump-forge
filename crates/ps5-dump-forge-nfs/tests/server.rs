//! Against a real server, only when `FORGE_NFS_TEST=nfs://host[:port]/path/to/writable/folder` is
//! set (`tests/scripts/nfs.sh up` prints one per server: unfs3 for NFSv3, NFS-Ganesha for
//! NFSv4.1, each exporting `/share` with a generated game `game-nfs` and a writable folder `out`).
//! `FORGE_NFS_TEST_VERSION` (`NFSv3` | `NFSv4.1`) is the version the session must speak;
//! The API removes files only, so the test's folders are cleaned up outside it:
//! `FORGE_NFS_TEST_LOCAL` (that folder on this machine) or `FORGE_NFS_TEST_CONTAINER` (a Docker
//! container serving the same server path, cleaned with `docker exec rm -rf`).

use ps5_dump_forge_nfs::Session;
use std::io::ErrorKind;

fn target() -> Option<(String, Option<u16>, String)> {
    let url = std::env::var("FORGE_NFS_TEST").ok()?;
    let rest = url.strip_prefix("nfs://").expect("nfs://host[:port]/path");
    let (addr, path) = rest.split_once('/').expect("a path");
    let (host, port) = match addr.rsplit_once(':') {
        Some((h, p)) if !h.contains(':') || h.ends_with(']') => (h, Some(p.parse().unwrap())),
        _ => (addr, None),
    };
    Some((
        host.into(),
        port,
        format!("/{}", path.trim_end_matches('/')),
    ))
}

/// Bytes that differ at every offset of a chunk, so a misplaced chunk shows.
fn pattern(len: usize) -> Vec<u8> {
    (0..len)
        .map(|i| (i as u32).wrapping_mul(2_654_435_761).rotate_right(13) as u8)
        .collect()
}

#[test]
fn writable_folder() {
    let Some((host, port, folder)) = target() else {
        eprintln!("FORGE_NFS_TEST not set: skipped");
        return;
    };
    let t = std::time::Instant::now();
    let s = Session::connect(&host, port).unwrap();
    eprintln!("connect: {} in {:?}", s.version(), t.elapsed());
    if let Ok(want) = std::env::var("FORGE_NFS_TEST_VERSION") {
        assert_eq!(s.version(), want);
    }

    // The path above the folder: the exports, then each folder down to it.
    let exports = s.exports().unwrap();
    eprintln!("exports: {exports:?}");
    assert!(!exports.is_empty());
    let root = s.list("/").unwrap();
    let first = folder.split('/').find(|c| !c.is_empty()).unwrap();
    assert!(root.iter().any(|e| e.name == first && e.dir), "{root:?}");
    assert!(s.stat("/").unwrap().dir);
    let (parent, name) = folder.rsplit_once('/').unwrap();
    let parent = if parent.is_empty() { "/" } else { parent };
    let above = s.list(parent).unwrap();
    assert!(above.iter().any(|e| e.name == name && e.dir), "{above:?}");
    let st = s.stat(&folder).unwrap();
    assert!(st.dir && st.name == name, "{st:?}");

    // The generated game beside the folder, when there.
    if above.iter().any(|e| e.name == "game-nfs") {
        let game = format!("{parent}/game-nfs").replace("//", "/");
        let names: Vec<_> = s.list(&game).unwrap().into_iter().map(|e| e.name).collect();
        assert!(names.iter().any(|n| n == "eboot.bin"), "{names:?}");
        let param = s.stat(&format!("{game}/sce_sys/param.json")).unwrap();
        let bytes = s
            .read_at(&format!("{game}/sce_sys/param.json"), 0, 1 << 20)
            .unwrap();
        assert_eq!(bytes.len() as u64, param.size);
        assert!(bytes.starts_with(b"{"));
        // Every file (tests/scripts/nfs.sh's game has 200 small ones and a big one), the biggest
        // read.
        let t = std::time::Instant::now();
        let (mut todo, mut files) = (vec![game.clone()], Vec::new());
        while let Some(d) = todo.pop() {
            for e in s.list(&d).unwrap() {
                let p = format!("{d}/{}", e.name);
                if e.dir {
                    todo.push(p);
                } else {
                    assert_eq!(s.stat(&p).unwrap(), e, "list vs stat of {p}");
                    files.push((e.size, p));
                }
            }
        }
        let total: u64 = files.iter().map(|f| f.0).sum();
        eprintln!(
            "game: {} files, {} MiB, walked in {:?}",
            files.len(),
            total >> 20,
            t.elapsed()
        );
        let (size, big) = files.iter().max().unwrap();
        let t = std::time::Instant::now();
        assert_eq!(
            s.read_at(big, 0, *size as usize).unwrap().len() as u64,
            *size
        );
        eprintln!("read {big}: {} MiB in {:?}", size >> 20, t.elapsed());
    }
    let missing = s.stat(&format!("{folder}/nope")).unwrap_err();
    assert_eq!(missing.kind(), ErrorKind::NotFound, "{missing}");
    assert!(missing.to_string().contains("nope"), "{missing}");

    let free = s.free_space(&folder).unwrap();
    eprintln!("free: {} MiB", free >> 20);
    assert!(free > 0);

    // A folder of our own, never replaced.
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let dir = format!("{folder}/forge-test-{}-{nanos}", std::process::id());
    s.mkdir(&dir).unwrap();
    assert_eq!(s.mkdir(&dir).unwrap_err().kind(), ErrorKind::AlreadyExists);
    assert!(s.stat(&dir).unwrap().dir);
    assert!(s.list(&dir).unwrap().is_empty());

    // 9 MiB + a tail in 1 MiB + 7 chunks, last first (past any server's wtmax), then synced.
    let data = pattern((9 << 20) + 4321);
    let a = format!("{dir}/a.bin");
    let f = s.create(&a).unwrap();
    assert_eq!(
        s.create(&a).map(drop).unwrap_err().kind(),
        ErrorKind::AlreadyExists
    );
    let chunk = (1 << 20) + 7;
    let starts: Vec<usize> = (0..data.len()).step_by(chunk).collect();
    let t = std::time::Instant::now();
    for &at in starts.iter().rev() {
        let end = (at + chunk).min(data.len());
        f.write_at(at as u64, &data[at..end]).unwrap();
    }
    f.sync().unwrap();
    drop(f);
    eprintln!(
        "write {} MiB: {:.1} MB/s",
        data.len() >> 20,
        data.len() as f64 / t.elapsed().as_secs_f64() / 1e6
    );

    let st = s.stat(&a).unwrap();
    assert_eq!(
        (st.name.as_str(), st.dir, st.size),
        ("a.bin", false, data.len() as u64)
    );
    let t = std::time::Instant::now();
    let back = s.read_at(&a, 0, data.len()).unwrap();
    eprintln!(
        "read {} MiB: {:.1} MB/s",
        back.len() >> 20,
        back.len() as f64 / t.elapsed().as_secs_f64() / 1e6
    );
    assert!(back == data, "read back differs");
    let mid = s.read_at(&a, 3_000_001, 2_500_000).unwrap();
    assert!(mid == data[3_000_001..5_500_001]);
    let tail = s.read_at(&a, data.len() as u64 - 10, 100).unwrap();
    assert_eq!(tail, data[data.len() - 10..]);
    assert!(s.read_at(&a, data.len() as u64 + 5, 10).unwrap().is_empty());

    // A listing and a stat agree, mtime included.
    let listed = s.list(&dir).unwrap();
    assert_eq!(listed, std::slice::from_ref(&st), "list vs stat");
    assert!(st.mtime.is_some());

    // Renames never replace.
    let b = format!("{dir}/b.bin");
    s.rename_no_replace(&a, &b).unwrap();
    assert_eq!(s.stat(&a).unwrap_err().kind(), ErrorKind::NotFound);
    assert_eq!(s.stat(&b).unwrap().size, data.len() as u64);
    let c = format!("{dir}/c.bin");
    let f = s.create(&c).unwrap();
    f.write_at(0, b"c").unwrap();
    f.sync().unwrap();
    drop(f);
    let taken = s.rename_no_replace(&b, &c).unwrap_err();
    assert_eq!(taken.kind(), ErrorKind::AlreadyExists, "{taken}");
    assert_eq!(s.stat(&b).unwrap().size, data.len() as u64);
    assert_eq!(s.read_at(&c, 0, 10).unwrap(), b"c");

    // A folder renamed (no LINK for folders: the two-step fallback), then removals.
    let sub = format!("{dir}/sub");
    s.mkdir(&sub).unwrap();
    let moved = format!("{dir}/moved");
    s.rename_no_replace(&sub, &moved).unwrap();
    assert!(s.stat(&moved).unwrap().dir);
    assert_eq!(s.stat(&sub).unwrap_err().kind(), ErrorKind::NotFound);
    s.remove(&b).unwrap();
    s.remove(&c).unwrap();
    assert_eq!(s.remove(&c).unwrap_err().kind(), ErrorKind::NotFound);
    let mut left: Vec<_> = s.list(&dir).unwrap().into_iter().map(|e| e.name).collect();
    left.sort();
    assert_eq!(left, ["moved"]);

    // Folders: `remove` takes files only (v4's REMOVE would take an empty folder).
    assert_eq!(
        s.remove(&moved).unwrap_err().kind(),
        ErrorKind::IsADirectory
    );
    if let Ok(local) = std::env::var("FORGE_NFS_TEST_LOCAL") {
        let name = dir.rsplit('/').next().unwrap();
        std::fs::remove_dir_all(std::path::Path::new(&local).join(name)).unwrap();
        eprintln!("cleanup: {local}/{name}");
    } else if let Ok(container) = std::env::var("FORGE_NFS_TEST_CONTAINER") {
        let ok = std::process::Command::new("docker")
            .args(["exec", &container, "rm", "-rf", &dir])
            .status()
            .is_ok_and(|s| s.success());
        assert!(ok, "docker exec {container} rm -rf {dir}");
        eprintln!("cleanup: {container}:{dir}");
    } else {
        eprintln!("cleanup: {dir} left on the server");
    }
}
