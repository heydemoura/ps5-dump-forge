#!/usr/bin/env node
// A fake PS5 game folder for the smoke tests: sce_sys/param.json, an eboot.bin (optionally one
// "importing" libSceAmpr, which is all Forge's AMPR check looks for), compressible assets, noise,
// one big file, many small ones, an empty folder and an empty file. Deterministic: the same
// arguments give the same bytes. Plain node, no dependencies.
//
//   node tests/scripts/gen-game.mjs <out_dir> [--files N] [--big-mib M] [--assets-mib M] [--ampr]
//                           [--title-id PPSA99901] [--name "Forge Smoke"]
import fs from 'node:fs';
import path from 'node:path';

const LIMIT = 1024 ** 3; // the suite's own rule: a generated game stays within 1 GiB
const MIB = 1024 * 1024;

function parse(argv) {
  const o = { files: 200, bigMib: 80, assetsMib: 48, ampr: false, titleId: 'PPSA99901', name: 'Forge Smoke' };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--files') o.files = Number(next());
    else if (a === '--big-mib') o.bigMib = Number(next());
    else if (a === '--assets-mib') o.assetsMib = Number(next());
    else if (a === '--ampr') o.ampr = true;
    else if (a === '--title-id') o.titleId = next();
    else if (a === '--name') o.name = next();
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else rest.push(a);
  }
  if (rest.length !== 1) throw new Error('usage: gen-game.mjs <out_dir> [options]');
  for (const k of ['files', 'bigMib', 'assetsMib']) {
    if (!Number.isInteger(o[k]) || o[k] < 0) throw new Error(`--${k} must be a whole number`);
  }
  if (!/^[A-Z]{4}\d{5}$/.test(o.titleId)) throw new Error('--title-id looks like PPSA12345');
  o.out = rest[0];
  return o;
}

// xorshift32: fast, seeded, good enough to defeat compression.
function noise(seed) {
  let x = seed >>> 0 || 1;
  return (buf) => {
    for (let i = 0; i + 4 <= buf.length; i += 4) {
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5; x >>>= 0;
      buf.writeUInt32LE(x, i);
    }
    return buf;
  };
}

// Text-like bytes LZ4 shrinks well, varied per file so no two are identical.
function text(seed) {
  const words = ['forge', 'smoke', 'asset', 'mesh', 'texture', 'level', 'shader', 'audio', 'chunk', 'pack'];
  let n = seed;
  return (buf) => {
    let i = 0;
    while (i < buf.length) {
      const w = `${words[n++ % words.length]}${n % 97} `;
      i += buf.write(w, i);
    }
    return buf;
  };
}

function writeFile(root, rel, size, fill) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const fd = fs.openSync(p, 'wx');
  try {
    const chunk = Buffer.alloc(Math.min(size, MIB) || 0);
    for (let left = size; left > 0; ) {
      const n = Math.min(left, chunk.length);
      fill(chunk);
      fs.writeSync(fd, chunk, 0, n);
      left -= n;
    }
  } finally {
    fs.closeSync(fd);
  }
  return size;
}

// A 1x1 PNG, so the Library and the cards have a cover to read.
const ICON = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function main() {
  const o = parse(process.argv.slice(2));
  const planned = o.bigMib * MIB + o.assetsMib * MIB + o.files * 8 * 1024 + MIB;
  if (planned > LIMIT) throw new Error(`that game would be ~${Math.ceil(planned / MIB)} MiB; the limit is 1024`);
  if (fs.existsSync(o.out)) throw new Error(`${o.out} exists; pick a new folder`);
  fs.mkdirSync(o.out, { recursive: true });
  const put = (rel, bytes) => writeFile(o.out, rel, bytes.length, (b) => bytes.copy(b));
  let total = 0;

  const eboot = Buffer.alloc(64 * 1024);
  Buffer.from(o.ampr ? '\x7fELF fake eboot importing libSceAmpr.sprx' : '\x7fELF fake eboot', 'latin1').copy(eboot);
  total += put('eboot.bin', eboot);
  const param = {
    titleId: o.titleId,
    contentId: `UP9999-${o.titleId}_00-FORGESMOKE000000`,
    contentVersion: '01.000.000',
    requiredSystemSoftwareVersion: '0x0400000000000000',
    applicationCategoryType: 0,
    localizedParameters: { defaultLanguage: 'en-US', 'en-US': { titleName: o.name } },
  };
  total += put('sce_sys/param.json', Buffer.from(JSON.stringify(param, null, 2)));
  total += put('sce_sys/icon0.png', ICON);

  // Assets: 1 MiB files, half compressible text, half noise (LZ4 packs the first, keeps RAW chunks
  // of the second).
  for (let i = 0; i < o.assetsMib; i++) {
    const rel = `data/assets/${i % 2 ? 'noise' : 'level'}${String(i).padStart(3, '0')}.bin`;
    total += writeFile(o.out, rel, MIB - 4096 * (i % 3), i % 2 ? noise(1000 + i) : text(i));
  }
  if (o.bigMib) total += writeFile(o.out, 'data/big.bin', o.bigMib * MIB + 12345, noise(7));
  // Many small files, 100 per folder, sizes 1..8 KiB.
  for (let i = 0; i < o.files; i++) {
    const rel = `data/many/${String(Math.floor(i / 100)).padStart(3, '0')}/f${String(i).padStart(5, '0')}.bin`;
    total += writeFile(o.out, rel, 1024 * (1 + (i % 8)) - (i % 7), noise(50_000 + i));
  }
  total += put('data/a b.txt', Buffer.from('a name with a space\n'));
  total += put('data/zero.bin', Buffer.alloc(0));
  fs.mkdirSync(path.join(o.out, 'data/empty'), { recursive: true });
  console.log(JSON.stringify({ out: path.resolve(o.out), bytes: total, files: o.files + o.assetsMib + (o.bigMib ? 1 : 0) + 5 }));
}

try {
  main();
} catch (e) {
  console.error(`gen-game: ${e.message}`);
  process.exit(1);
}
