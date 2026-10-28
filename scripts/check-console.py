#!/usr/bin/env python3
"""Compare the original console engine with Forge on synthetic games."""
import json
import os
from pathlib import Path
import struct
import shlex
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
FORGE = Path(sys.argv[1]).resolve()
NATIVE = ROOT / 'crates/ps5-dump-forge-lz4/native/console'
REF = ROOT / 'tests/console-reference'

def run(args):
    args=list(map(str,args))
    if Path(args[0])==FORGE:
        args=shlex.split(os.environ.get("FORGE_CONSOLE_RUNNER",""))+args
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(' '.join(map(str, args)) + '\n' + p.stdout[-3000:] + p.stderr[-3000:])
    return p.stdout

def chunks(root):
    m = (root / 'ampr_assets.index').read_bytes()
    count, = struct.unpack_from('<Q', m, 40)
    files, blocks, packs, strings = struct.unpack_from('<QQQQ', m, 72)
    volumes = []
    for i in range(struct.unpack_from('<I', m, 56)[0]):
        name_off, name_len = struct.unpack_from('<II', m, packs + i * 32 + 16)
        volumes.append(root / m[strings+name_off:strings+name_off+name_len].decode())
    result = {}
    physical = {}
    for i in range(count):
        f = files + i * 48
        first, n, name_off, name_len, flags = struct.unpack_from('<IIIII', m, f+24)
        name = m[strings+name_off:strings+name_off+name_len].decode().removeprefix('/app0/')
        if not flags & 1:
            continue
        data = []
        for b in range(first, first+n):
            loc, desc = struct.unpack_from('<QI', m, blocks+b*12)
            with volumes[loc >> 48].open('rb') as v:
                v.seek(loc & ((1 << 48)-1))
                payload = v.read((desc & 0xfffff)+1)
            physical[(loc>>48,loc&((1<<48)-1))]=len(payload)
            data.append(((desc >> 20) & 3, payload))
        result[name] = (m[f+44], flags & 0x1f, data)
    return result,len(physical),sum(physical.values())

with tempfile.TemporaryDirectory(prefix='forge-console-diff-') as temp:
    tmp = Path(temp)
    oracle = tmp / 'console-original'
    run(['cc', '-O2', '-D_GNU_SOURCE', '-I'+str(REF), '-I'+str(NATIVE),
         REF/'main.c', REF/'ampr_pack.c', REF/'ampr_index.c',
         NATIVE/'ampr_pack_profile.c', NATIVE/'ampr_pack_toml.c',
         NATIVE/'lz4.c', NATIVE/'lz4hc.c', '-pthread', '-lz', '-o', oracle])
    source = tmp / 'source'
    (source/'sce_sys').mkdir(parents=True)
    (source/'audio').mkdir()
    (source/'nested').mkdir()
    (source/'cache_ps5').mkdir()
    (source/'eboot.bin').write_bytes(b'fixture libSceAmpr\0')
    (source/'sce_sys/param.json').write_text(json.dumps({'titleId':'PPSA31246','localizedParameters':{'en-US':{'titleName':'Synthetic policy test'}}}))
    # Root numbered archives reproduce the Resident Evil selection difference.
    block = (b'console policy HC fixture\0' * 3000)[:65536]
    (source/'re_chunk_000.pak').write_bytes(block * 5 + b'end')
    (source/'re_chunk_001.pak').write_bytes(block * 7 + b'end')
    (source/'re_chunk_001.pak.patch_001.pak').write_bytes(block)
    (source/'nested/archive.pak').write_bytes(block)
    (source/'nested/texture.dds').write_bytes(block)
    (source/'nested/data.bin').write_bytes(block * 2)
    (source/'audio/voices.bin').write_bytes(block * 2)
    (source/'cache_ps5/playgo.pgm').write_bytes(block)
    (source/'cache_ps5/pgc_1_dummy_file').write_bytes(block)
    (source/'nested/empty.bin').touch()
    with (source/'nested/noise.bin').open('wb') as noise:
        incompressible=os.urandom(65536)
        for _ in range(1024): noise.write(incompressible)
    for level in (1, 9, 12):
        expected = tmp / ('original-'+str(level)); expected.mkdir()
        actual = tmp / ('forge-'+str(level))
        run([oracle, source, expected, ROOT/'vendor/ampr_emu/libSceAmpr.sprx', level, "", NATIVE/"profiles"])
        run([FORGE, 'convert', source, '--to', 'lz4', '--lz4-level', level, '-o', actual, '--full-verify'])
        (want, wn, wb), (got, gn, gb) = chunks(expected), chunks(actual)
        assert (wn,wb)==(gn,gb), (level,"deduplication differs",(wn,wb),(gn,gb))
        assert want.keys() == got.keys(), (level, want.keys(), got.keys())
        for name in want:
            assert want[name] == got[name], (level, name, 'block size, flags or compressed chunk bytes differ')
        print('PASS console differential level', level, 'files', list(got))

    profiles={
        "streaming": "[pack]\ndefault_action=\"loose\"\n[[rule]]\ninclude=[\"re_chunk_*.pak\"]\nlayout=\"streaming\"\n",
        "hot": "[pack]\ndefault_action=\"loose\"\n[[rule]]\ninclude=[\"nested/data.bin\"]\nblock_size=\"16KiB\"\nhot=true\nmin_savings_bytes=16\nmin_savings_ratio=0.0025\nio_neutral_min_savings_bytes=2048\n",
        "no-dedup": "[pack]\ndefault_action=\"loose\"\ndeduplicate=false\n[[rule]]\ninclude=[\"re_chunk_*.pak\"]\n",
    }
    for label,text in profiles.items():
        profile=tmp/(label+".toml");profile.write_text(text)
        expected=tmp/(label+"-original");expected.mkdir()
        actual=tmp/(label+"-forge")
        run([oracle,source,expected,ROOT/'vendor/ampr_emu/libSceAmpr.sprx',9,profile,NATIVE/'profiles'])
        run([FORGE,'convert',source,'--to','lz4','--lz4-profile',profile,'-o',actual,'--full-verify'])
        (want,wn,wb),(got,gn,gb)=chunks(expected),chunks(actual)
        assert want==got,(label,"profile block selection/encoding differs")
        assert (wn,wb)==(gn,gb),(label,"profile deduplication differs")
        print('PASS console differential profile',label)
