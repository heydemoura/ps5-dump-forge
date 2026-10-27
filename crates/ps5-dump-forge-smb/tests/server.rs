//! Against a real server, only when `FORGE_SMB_TEST=smb://[user[:pass]@]host[:port]/share` is set
//! (`tests/scripts/nas.sh up` prints it: Samba in Docker, a guest share `games` holding "Stub Game"
//! and a writable folder `out`). `FORGE_SMB_TEST_LOCAL` (that share's "Stub Game" on this machine)
//! compares what is read; `FORGE_SMB_TEST_SHARE_DIR` (the share's folder) removes the folder the
//! write test leaves.

use ps5_dump_forge_smb::{DEFAULT_PORT, Session};

fn target() -> Option<(String, u16, String, String, String)> {
    let url = std::env::var("FORGE_SMB_TEST").ok()?;
    let rest = url.strip_prefix("smb://").expect("smb://host/share");
    let (auth, rest) = rest.rsplit_once('@').map_or(("", rest), |(a, r)| (a, r));
    let (user, pass) = auth.split_once(':').unwrap_or((auth, ""));
    let (addr, share) = rest.split_once('/').expect("a share");
    let (host, port) = match addr.rsplit_once(':') {
        Some((h, p)) => (h, p.parse().unwrap()),
        None => (addr, DEFAULT_PORT),
    };
    Some((
        host.into(),
        port,
        user.into(),
        pass.into(),
        share.trim_end_matches('/').into(),
    ))
}

#[test]
fn stub_game() {
    let Some((host, port, user, pass, share)) = target() else {
        eprintln!("FORGE_SMB_TEST not set: skipped");
        return;
    };
    let t = std::time::Instant::now();
    let s = Session::connect(&host, port, &user, &pass).unwrap();
    eprintln!("connect + login: {:?}", t.elapsed());
    let shares = s.shares().unwrap();
    assert!(
        shares.iter().any(|n| n.eq_ignore_ascii_case(&share)),
        "{shares:?}"
    );

    let root = s.list(&share, "").unwrap();
    assert!(
        root.iter().any(|e| e.name == "Stub Game" && e.dir),
        "{root:?}"
    );
    let game = s.list(&share, "Stub Game").unwrap();
    let mut names: Vec<_> = game.iter().map(|e| (e.name.as_str(), e.dir)).collect();
    names.sort();
    assert_eq!(
        names,
        [("data", true), ("eboot.bin", false), ("sce_sys", true)]
    );
    let sys = s.list(&share, "Stub Game/sce_sys").unwrap();
    assert!(
        sys.iter()
            .any(|e| e.name == "param.json" && e.size > 0 && e.mtime > 1_600_000_000)
    );

    let st = s.stat(&share, "Stub Game/data/stub.bin").unwrap();
    assert_eq!(
        (st.name.as_str(), st.dir, st.size),
        ("stub.bin", false, 4 << 20)
    );
    assert!(s.stat(&share, "Stub Game").unwrap().dir);
    let missing = s.stat(&share, "Stub Game/nope").unwrap_err();
    assert_eq!(missing.kind(), std::io::ErrorKind::NotFound, "{missing}");

    // A range across a 1 MiB boundary and the whole file, against the local copy when it's here.
    let f = s.open(&share, "Stub Game/data/stub.bin").unwrap();
    let mut part = vec![0u8; 3 << 19];
    assert_eq!(f.read_at(1_000_000, &mut part).unwrap(), part.len());
    let mut all = vec![0u8; f.size() as usize];
    let t = std::time::Instant::now();
    assert_eq!(f.read_at(0, &mut all).unwrap(), all.len());
    let secs = t.elapsed().as_secs_f64();
    eprintln!(
        "read {} MiB: {:.1} MB/s",
        all.len() >> 20,
        all.len() as f64 / secs / 1e6
    );
    assert_eq!(&all[1_000_000..1_000_000 + part.len()], &part[..]);
    let mut end = [0u8; 16];
    assert_eq!(f.read_at(f.size() - 4, &mut end).unwrap(), 4);
    assert_eq!(f.read_at(f.size(), &mut end).unwrap(), 0);
    if let Ok(local) = std::env::var("FORGE_SMB_TEST_LOCAL") {
        let want = std::fs::read(std::path::Path::new(&local).join("data/stub.bin")).unwrap();
        assert!(want == all, "the bytes differ from {local}");
    }
    let sys_file = s.open(&share, "Stub Game/sce_sys/param.json").unwrap();
    let mut json = vec![0u8; sys_file.size() as usize];
    sys_file.read_at(0, &mut json).unwrap();
    assert!(String::from_utf8_lossy(&json).contains("PPSA99999"));
}

#[test]
fn writes_new_files_and_never_replaces() {
    let Some((host, port, user, pass, share)) = target() else {
        eprintln!("FORGE_SMB_TEST not set: skipped");
        return;
    };
    let s = Session::connect(&host, port, &user, &pass).unwrap();
    let dir = format!("out/smb-test-{}", std::process::id());
    s.mkdir(&share, &dir).unwrap();
    let kind = |r: std::io::Result<()>| r.unwrap_err().kind();
    assert_eq!(
        kind(s.mkdir(&share, &dir)),
        std::io::ErrorKind::AlreadyExists
    );
    assert!(s.free_space(&share, &dir).unwrap() > 0);

    // Past one WRITE's size, out of order, then read back.
    let body: Vec<u8> = (0..3_000_000u32).map(|i| (i % 251) as u8).collect();
    let tmp = format!("{dir}/a.tmp");
    let f = s.create_file(&share, &tmp).unwrap();
    f.write_at(1_000_000, &body[1_000_000..]).unwrap();
    f.write_at(0, &body[..1_000_000]).unwrap();
    f.flush().unwrap();
    drop(f);
    assert!(s.create_file(&share, &tmp).is_err(), "created over a file");
    let r = s.open(&share, &tmp).unwrap();
    let mut back = vec![0u8; body.len()];
    assert_eq!(r.read_at(0, &mut back).unwrap(), body.len());
    assert!(back == body);
    drop(r);

    // Renamed, never over a file there.
    let done = format!("{dir}/a.bin");
    s.rename(&share, &tmp, &done).unwrap();
    s.create_file(&share, &tmp)
        .unwrap()
        .write_at(0, b"x")
        .unwrap();
    assert_eq!(
        kind(s.rename(&share, &tmp, &done)),
        std::io::ErrorKind::AlreadyExists
    );
    assert_eq!(s.stat(&share, &done).unwrap().size, body.len() as u64);
    // Replacing: the file over the file, never over a folder.
    s.rename_replace(&share, &tmp, &done).unwrap();
    assert_eq!(s.stat(&share, &done).unwrap().size, 1);
    assert_eq!(
        s.stat(&share, &tmp).unwrap_err().kind(),
        std::io::ErrorKind::NotFound
    );
    let sub = format!("{dir}/sub");
    s.mkdir(&share, &sub).unwrap();
    s.create_file(&share, &tmp).unwrap();
    assert!(
        s.rename_replace(&share, &tmp, &sub).is_err(),
        "over a folder"
    );
    assert!(s.stat(&share, &sub).unwrap().dir);
    for f in [&tmp, &done] {
        s.remove(&share, f).unwrap();
    }
    assert_eq!(
        s.stat(&share, &done).unwrap_err().kind(),
        std::io::ErrorKind::NotFound
    );
    s.rename(&share, &dir, &format!("{dir}-gone")).unwrap();
    // The client removes files only: the share's folder on this machine, when given, loses the
    // emptied one.
    if let Ok(local) = std::env::var("FORGE_SMB_TEST_SHARE_DIR") {
        std::fs::remove_dir_all(std::path::Path::new(&local).join(format!("{dir}-gone"))).unwrap();
    }
}
