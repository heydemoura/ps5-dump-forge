fn main() {
    let base = "native/console";
    cc::Build::new()
        .include("native")
        .include(base)
        .files([
            "native/bridge.c",
            "native/console/ampr_pack_profile.c",
            "native/console/ampr_pack_toml.c",
            "native/console/lz4.c",
            "native/console/lz4hc.c",
        ])
        .define("_GNU_SOURCE", None)
        .warnings(false)
        .compile("forge_console_lz4");
    println!("cargo:rerun-if-changed=native");
}
