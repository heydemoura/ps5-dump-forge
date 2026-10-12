//! Writing at game scale: the streaming writer must emit exactly what the in-memory
//! writer emits, and must refuse what it cannot yet cover.

use std::path::{Path, PathBuf};

use ps5upload_fpkg::build::{self, BuildRequest};

const CONTENT_ID: &str = "UP0000-PPSA05555_00-SCALETEST0000000";
const SEED: [u8; 16] = [0x33; 16];
const TIME: (i64, u32) = (1_700_000_000, 0);

struct TempDir(PathBuf);

impl TempDir {
    fn new(name: &str) -> Self {
        let dir = std::env::temp_dir().join(format!("fpkg-scale-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        Self(dir)
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.0).ok();
    }
}

/// A tree that crosses block boundaries in both directions: a file smaller than a block,
/// one that spans several, and the `sce_sys` set the container carries.
fn write_tree(root: &Path) {
    let title_id = &CONTENT_ID[7..16];
    let put = |path: &str, data: Vec<u8>| {
        let full = root.join(path);
        std::fs::create_dir_all(full.parent().unwrap()).unwrap();
        std::fs::write(&full, &data).unwrap();
    };
    // A fake SELF, as a real converted folder would carry.
    let mut eboot: Vec<u8> = vec![0x54, 0x14, 0xF5, 0xEE];
    eboot.extend((0..3996u32).map(|i| (i % 241) as u8));
    put("eboot.bin", eboot);
    put(
        "data/one.bin",
        (0..600_000u32).map(|i| (i % 199) as u8).collect(),
    );
    put("data/two.bin", vec![0x5A; 5000]);
    put(
        "sce_sys/param.json",
        format!(
            "{{\"contentId\":\"{CONTENT_ID}\",\"contentVersion\":\"01.002.003\",\
             \"titleName\":\"Scale Test\",\"titleId\":\"{title_id}\",\
             \"requiredSystemSoftwareVersion\":\"0x1160000000000000\"}}"
        )
        .into_bytes(),
    );
    put("sce_sys/icon0.png", vec![0x89; 2048]);
    put("sce_sys/icon0.dds", vec![0x44; 4096]);
    put("sce_sys/about/right.sprx", vec![0x54, 0x14, 0xF5, 0xEE]);
}

fn request(source: &Path, out: &Path) -> BuildRequest {
    BuildRequest {
        time: Some(TIME),
        seed: Some(SEED),
        // These tests read the stored image back through the container. The default is `Stored`,
        // whose round trip `mounts.rs` covers.
        metadata_codec: ps5upload_fpkg::inner::MetaCodec::Zlib,
        // And they exercise the flat layout's writers; the block layout that is now the default
        // round-trips in `writer.rs`.
        kraken: false,
        ..BuildRequest::new(source, out)
    }
}

/// The whole point of the streaming rewrite: for the same plan, seed and time, it must
/// produce the same file as the writer gate G2 verified. Byte for byte — the header,
/// every encrypted block, the container and the install metadata.
#[test]
fn the_streaming_writer_matches_the_in_memory_writer() {
    let source = TempDir::new("oracle-source");
    let streamed_dir = TempDir::new("oracle-streamed");
    let memory_dir = TempDir::new("oracle-memory");
    write_tree(source.path());

    let streamed = build::build(&request(source.path(), streamed_dir.path()), &mut |_| {}).unwrap();
    assert!(streamed.verify.ok(), "{}", streamed.verify);
    let in_memory =
        build::build_in_memory(&request(source.path(), memory_dir.path()), &mut |_| {}).unwrap();
    assert!(in_memory.verify.ok(), "{}", in_memory.verify);

    let a = std::fs::read(&streamed.path).unwrap();
    let b = std::fs::read(&in_memory.path).unwrap();
    assert_eq!(a.len(), b.len(), "the two writers disagree on the size");
    if a != b {
        let at = a.iter().zip(&b).position(|(x, y)| x != y).unwrap();
        panic!(
            "the two writers disagree at {at:#x} of {:#x}: {:#04x} against {:#04x}",
            a.len(),
            a[at],
            b[at]
        );
    }
    assert_eq!(streamed.content_id, CONTENT_ID);
    assert_eq!(in_memory.content_id, CONTENT_ID);
}

/// A real title's tree is far past one block: Minecraft's mount has 37,565 inodes and a
/// single directory can hold thousands of entries. A structure that outgrows a block just
/// runs on into the next, so the inode table and a directory's dirents are read as the byte
/// range they claim, not as one block. Kept small enough to run with the default suite.
#[test]
fn a_tree_with_blocks_of_inodes_round_trips() {
    let source = TempDir::new("deep-source");
    let out = TempDir::new("deep-out");
    let out_memory = TempDir::new("deep-memory");
    write_tree(source.path());
    // One flat directory whose dirents alone fill more than a 64 KiB block, and whose files
    // push the inode table past one too.
    let many = source.path().join("data/many");
    std::fs::create_dir_all(&many).unwrap();
    for i in 0..3000u32 {
        std::fs::write(
            many.join(format!("entry{i:05}.bin")),
            (0..64u32).map(|b| (b + i) as u8).collect::<Vec<u8>>(),
        )
        .unwrap();
    }

    let report = build::build(&request(source.path(), out.path()), &mut |_| {}).unwrap();
    assert!(report.verify.ok(), "{}", report.verify);
    let memory =
        build::build_in_memory(&request(source.path(), out_memory.path()), &mut |_| {}).unwrap();
    assert!(memory.verify.ok(), "{}", memory.verify);

    let files = in_image(ps5upload_fpkg::source::scan(source.path()).unwrap());
    let plan = ps5upload_fpkg::plan::build(&files).unwrap();
    // The point of the test: this tree does not fit the region's first block, and the plan
    // says so with an explicit region rather than by failing.
    let inodes = plan.files.len() as u64 + plan.dirs.len() as u64;
    assert!(inodes > 3000, "the tree must carry {inodes} inodes");
    assert!(
        plan.metadata.blocks > 2,
        "a {inodes}-inode tree needs a multi-block metadata region, got {}",
        plan.metadata.blocks
    );
    assert!(
        plan.metadata.inode_table.1 > ps5upload_fpkg::BLOCK,
        "the inode table itself must outgrow a block: {} bytes",
        plan.metadata.inode_table.1
    );
    let flat = plan
        .dirs
        .iter()
        .find(|d| d.path == "data/many")
        .expect("the flat directory is in the plan");
    assert!(
        ps5upload_fpkg::plan::dirent_size("entry00000.bin") as u64
            * (flat.dirents.len() as u64 - 2)
            > ps5upload_fpkg::BLOCK,
        "the flat directory's dirents must outgrow a block"
    );

    assert_eq!(
        std::fs::read(&report.path).unwrap(),
        std::fs::read(&memory.path).unwrap(),
        "the two writers disagree on a multi-block metadata region"
    );

    // The reader walks the whole tree back out through the multi-block region.
    let mut pkg = ps5upload_fpkg::PkgFile::open(&report.path).unwrap();
    let head = pkg.read_at(0, ps5upload_fpkg::fih::HEADER_LEN).unwrap();
    let fih = ps5upload_fpkg::fih::parse(&head).unwrap();
    let container = ps5upload_fpkg::cnt::read(&mut pkg, fih.cnt_offset).unwrap();
    let img = ps5upload_fpkg::outer::open(
        &mut pkg,
        &fih,
        &container,
        ps5upload_fpkg::crypto::DEFAULT_PASSCODE,
    )
    .unwrap();
    let nodes = img.dinodes();
    let inner_image = img.file_data(&nodes[3]);
    // The stored image is shorter than the mount: its metadata region is a container.
    let mount = ps5upload_fpkg::inner::logical_mount(
        &inner_image,
        plan.meta_base,
        ps5upload_fpkg::inner::MetaCodec::Zlib,
        &plan.placements(),
    )
    .unwrap();
    let inner = ps5upload_fpkg::inner::read(&mount, plan.meta_base).unwrap();
    assert!(inner.flt_ok);
    let mut recovered: Vec<(String, u64)> = inner
        .files
        .iter()
        .map(|f| (f.path.clone(), f.size))
        .collect();
    recovered.sort();
    let mut wanted: Vec<(String, u64)> = files
        .iter()
        .map(|f| (f.path.clone(), f.size))
        .chain([(
            "sce_sys/keystone".to_string(),
            ps5upload_fpkg::plan::KEYSTONE_LEN,
        )])
        .collect();
    wanted.sort();
    assert_eq!(recovered.len(), wanted.len(), "every file must survive");
    assert_eq!(recovered, wanted);
    eprintln!(
        "{inodes} inodes in {} metadata blocks; the whole tree walked back",
        plan.metadata.blocks
    );
}

/// The layout descriptor itself can outgrow a dinode's direct slots: enough files push
/// `naps_pkg_layout.dat` past twelve blocks (768 KiB), and its own dinode must then use
/// indirect tables, the same addressing the inner image uses. Minecraft is the first real
/// tree that lands here — 35,260 files need seventeen blocks — and the alternative,
/// dropping descriptor records until it fits, was measured on hardware to break the mount,
/// so the descriptor has to be addressed rather than shrunk.
///
/// Ignored by default: it writes ~36,000 files.
#[test]
#[ignore = "writes ~36,000 files to the temp directory"]
fn a_descriptor_past_the_direct_slots_round_trips() {
    let source = TempDir::new("descriptor-source");
    let out = TempDir::new("descriptor-out");
    let out_memory = TempDir::new("descriptor-memory");
    write_tree(source.path());
    // Each tiny file costs the descriptor a face, a run record and a block record, so a
    // flat directory of them is the cheapest way to inflate it past the direct slots.
    let many = source.path().join("data/many");
    std::fs::create_dir_all(&many).unwrap();
    for i in 0..36_000u32 {
        std::fs::write(many.join(format!("f{i:05}.bin")), [i as u8; 8]).unwrap();
    }

    let report = build::build(&request(source.path(), out.path()), &mut |_| {}).unwrap();
    assert!(report.verify.ok(), "{}", report.verify);
    let memory =
        build::build_in_memory(&request(source.path(), out_memory.path()), &mut |_| {}).unwrap();
    assert!(memory.verify.ok(), "{}", memory.verify);
    assert_eq!(
        std::fs::read(&report.path).unwrap(),
        std::fs::read(&memory.path).unwrap(),
        "the two writers disagree on a descriptor past the direct slots"
    );

    // The descriptor's size is what the header records at 0xA8.
    let image = std::fs::read(&report.path).unwrap();
    let naps_len = u64::from_le_bytes(image[0xA8..0xB0].try_into().unwrap());
    let slots = ps5upload_fpkg::outer_write::DIRECT_SLOTS as u64;
    assert!(
        naps_len > slots * ps5upload_fpkg::BLOCK,
        "the tree must push the descriptor past the {slots} direct slots: {naps_len} bytes"
    );

    let mut pkg = ps5upload_fpkg::PkgFile::open(&report.path).unwrap();
    let head = pkg.read_at(0, ps5upload_fpkg::fih::HEADER_LEN).unwrap();
    let fih = ps5upload_fpkg::fih::parse(&head).unwrap();
    let container = ps5upload_fpkg::cnt::read(&mut pkg, fih.cnt_offset).unwrap();
    let img = ps5upload_fpkg::outer::open(
        &mut pkg,
        &fih,
        &container,
        ps5upload_fpkg::crypto::DEFAULT_PASSCODE,
    )
    .unwrap();
    let nodes = img.dinodes();
    let descriptor = &nodes[4];
    assert_eq!(descriptor.size, naps_len, "the dinode carries its bytes");
    assert_eq!(
        descriptor.blocks as u64,
        naps_len.div_ceil(ps5upload_fpkg::BLOCK),
        "and its block count"
    );
    assert!(descriptor.blocks as usize > ps5upload_fpkg::outer_write::DIRECT_SLOTS);
    assert_ne!(
        descriptor.indirect[0].block, 0,
        "a descriptor past the slots must use an indirect table"
    );
    assert!(
        img.indirect_ok(descriptor),
        "the descriptor's tables must hash what their parent recorded"
    );
    // The point of the test: the reader walks the descriptor back out through its table.
    let recovered = img.file_data(descriptor);
    assert_eq!(
        recovered.len() as u64,
        naps_len,
        "the reader must recover the whole descriptor through its indirect table"
    );
    assert!(
        ps5upload_fpkg::naps::parse(&recovered).is_ok(),
        "and what it recovers must still be a descriptor this crate parses"
    );
    eprintln!(
        "{naps_len} byte descriptor ({} blocks) over {} indirect slot(s); walked back",
        naps_len.div_ceil(ps5upload_fpkg::BLOCK),
        descriptor.indirect.iter().filter(|t| t.block != 0).count()
    );
}

/// A source that says `"free"` (or `"upgradable"`) must still produce a package that says
/// `"standard"`: the console shows a lock and refuses to start a title that says otherwise.
/// The user's own `param.json` never changes — the package carries the rewritten bytes.
#[test]
fn a_non_standard_drm_reaches_the_package_as_standard() {
    let source = TempDir::new("drm-source");
    let out = TempDir::new("drm-out");
    write_tree(source.path());
    let param = source.path().join("sce_sys/param.json");
    let title_id = &CONTENT_ID[7..16];
    let original = format!(
        "{{\"contentId\":\"{CONTENT_ID}\",\"contentVersion\":\"01.002.003\",\
         \"applicationDrmType\":\"free\",\"titleName\":\"Scale Test\",\"titleId\":\"{title_id}\"}}"
    );
    std::fs::write(&param, &original).unwrap();

    let report = build::build(&request(source.path(), out.path()), &mut |_| {}).unwrap();
    assert!(report.verify.ok(), "{}", report.verify);
    assert_eq!(
        std::fs::read_to_string(&param).unwrap(),
        original,
        "the source file must be left alone"
    );

    // Read the packaged copy back out of the built package's inner image.
    let files = in_image(ps5upload_fpkg::source::scan(source.path()).unwrap());
    let plan = ps5upload_fpkg::plan::build(&files).unwrap();
    let mut pkg = ps5upload_fpkg::PkgFile::open(&report.path).unwrap();
    let head = pkg.read_at(0, ps5upload_fpkg::BLOCK as usize).unwrap();
    let fih = ps5upload_fpkg::fih::parse(&head).unwrap();
    let cnt = ps5upload_fpkg::cnt::read(&mut pkg, fih.cnt_offset).unwrap();
    let img = ps5upload_fpkg::outer::open(
        &mut pkg,
        &fih,
        &cnt,
        ps5upload_fpkg::crypto::DEFAULT_PASSCODE,
    )
    .unwrap();
    let nodes = img.dinodes();
    let image = img.file_data(&nodes[3]);
    let mount_image = ps5upload_fpkg::inner::logical_mount(
        &image,
        plan.meta_base,
        ps5upload_fpkg::inner::MetaCodec::Zlib,
        &plan.placements(),
    )
    .unwrap();
    let mount = ps5upload_fpkg::inner::read(&mount_image, plan.meta_base).unwrap();
    let entry = mount
        .files
        .iter()
        .find(|f| f.path == "sce_sys/param.json")
        .expect("param.json is in the image");
    let at = entry.offset as usize;
    let packaged = &mount_image[at..at + entry.size as usize];
    let text = String::from_utf8_lossy(packaged);
    assert!(
        text.contains("\"applicationDrmType\":\"standard\""),
        "the packaged copy says {text}"
    );
    assert!(!text.contains("free"), "the packaged copy says {text}");
    assert_eq!(
        packaged.len(),
        original.len() + "standard".len() - "free".len(),
        "only the value's length changed"
    );
}

/// The files a build puts in the image: the icons and artwork the container carries are not.
fn in_image(
    mut files: Vec<ps5upload_fpkg::source::SourceFile>,
) -> Vec<ps5upload_fpkg::source::SourceFile> {
    files.retain(|f| {
        !(f.size > 0 && ps5upload_fpkg::cnt_write::CONTAINER_ONLY.contains(&f.path.as_str()))
    });
    files
}
