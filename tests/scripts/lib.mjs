// Helpers for smoke.mjs: a Forge's HTTP API with retries, jobs, hashing. Plain node (>= 18).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRIES = 6;

/** A network error (connection refused, reset, timed out): worth a retry. */
function lost(e) {
  return e?.name === 'TypeError' || e?.name === 'AbortError' || e?.name === 'TimeoutError' || /fetch failed|ECONN|socket|EPIPE/i.test(String(e?.cause ?? e));
}

/** One call; retried while the connection is lost or the server says 429/503. `once`: never
 * resent after the request may have arrived (start_job checks the job list instead). */
export async function call(base, route, body, { once = false, timeout = 120_000 } = {}) {
  const post = body !== undefined;
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(`${base}/api/${route}`, {
        method: post ? 'POST' : 'GET',
        headers: post ? { 'Content-Type': 'application/json' } : {},
        body: post ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeout),
      });
    } catch (e) {
      if (once || !lost(e) || attempt >= RETRIES) throw new Error(`${route}: ${e.cause?.message ?? e.message}`);
      await sleep(1000 * attempt);
      continue;
    }
    const text = await res.text();
    if ((res.status === 429 || res.status === 503) && attempt < RETRIES) {
      await sleep(1000 * attempt);
      continue;
    }
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const err = new Error(`${route}: HTTP ${res.status}: ${data?.error ?? text}`);
      err.status = res.status;
      err.text = data?.error ?? text;
      throw err;
    }
    return data;
  }
}

/** A full ConvertRequest from the fields a test sets. */
export function request(fields) {
  return { source: '', format: 'folder', output: '', compression_threads: null, inner: null,
    remove_backport: false, full_verify: false, kraken_level: 'fast', ...fields };
}

/** Starts a job; on a lost reply finds it in the job list rather than starting it twice. */
export async function start(base, req) {
  const before = new Set((await call(base, 'jobs')).jobs.map((j) => j.id));
  try {
    return await call(base, 'start_job', { request: req }, { once: true });
  } catch (e) {
    if (e.status) throw e;
    for (let i = 0; i < RETRIES; i++) {
      await sleep(2000);
      try {
        const job = (await call(base, 'jobs')).jobs.find((j) => !before.has(j.id) && JSON.stringify(j.request.output) === JSON.stringify(req.output));
        if (job) return job.id;
      } catch { /* still unreachable */ }
    }
    throw e;
  }
}

/** Waits for job `id`; `{ok, report, error, log}`. Prints progress every 15 s. */
export async function wait(base, id, { timeout = 30 * 60_000, onTick } = {}) {
  const end = Date.now() + timeout;
  let shown = 0;
  for (;;) {
    const job = (await call(base, 'jobs')).jobs.find((j) => j.id === id);
    if (!job) throw new Error(`job ${id} is gone from ${base}`);
    if (onTick) await onTick(job);
    if (job.done) {
      const r = job.done.result ?? {};
      return { ok: 'Ok' in r, report: r.Ok, error: r.Err, log: job.log };
    }
    if (Date.now() > end) throw new Error(`job ${id} still running after ${timeout / 1000} s`);
    if (Date.now() - shown > 15_000 && job.progress) {
      shown = Date.now();
      const p = job.progress;
      console.log(`      ${p.stage} ${p.total ? Math.floor((100 * p.done) / p.total) : 0}%`);
    }
    await sleep(1000);
  }
}

/** Runs a job to its end; throws with the log unless it ended Ok (or `expectError` matches). */
export async function run(base, req, opts = {}) {
  const id = await start(base, req);
  const r = await wait(base, id, opts);
  if (opts.expectError) {
    if (r.ok) throw new Error(`job ${id} succeeded; expected an error like ${opts.expectError}`);
    if (!opts.expectError.test(r.error)) throw new Error(`job ${id}: "${r.error}" doesn't match ${opts.expectError}`);
    return r;
  }
  if (!r.ok) throw new Error(`job ${id} failed: ${r.error}\n      log: ${r.log.slice(-8).join('\n           ')}`);
  return r;
}

/** Every file under `root` (relative `/` path → sha256 hex), junk-free trees only. */
export function hashTree(root) {
  const out = {};
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p, r);
      else if (e.isFile()) out[r] = hashFile(p);
    }
  };
  walk(root, '');
  return out;
}

export function hashFile(p) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(p, 'r');
  const buf = Buffer.alloc(8 << 20);
  try {
    for (let n; (n = fs.readSync(fd, buf, 0, buf.length, null)) > 0; ) h.update(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return h.digest('hex');
}

/** Throws naming the first few differences between two `hashTree`s (or `{path: size}` maps). */
export function same(want, got, what) {
  const bad = [];
  for (const k of new Set([...Object.keys(want), ...Object.keys(got)])) {
    if (want[k] !== got[k]) bad.push(`${k}: ${want[k] ?? 'missing'} vs ${got[k] ?? 'missing'}`);
  }
  if (bad.length) throw new Error(`${what}: ${bad.length} differ, e.g. ${bad.slice(0, 5).join('; ')}`);
}

/** `{path: size}` of a local tree, for comparing with a Forge's `host_tree`. */
export function sizeTree(root) {
  const out = {};
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p, r);
      else if (e.isFile()) out[r] = fs.statSync(p).size;
    }
  };
  walk(root, '');
  return out;
}

/** A Forge's view of its own folder, `{path: size}`. */
export async function remoteSizes(base, dir) {
  const t = await call(base, 'host_tree', { path: dir }, { timeout: 60_000 });
  if (t.truncated) throw new Error(`host_tree of ${dir} was truncated`);
  return Object.fromEntries(t.files.map((f) => [f.path, f.size]));
}

/** `flink://<key>/<path relative to the peer's share root>`. */
export function flink(key, share, abs) {
  const rel = path.posix.relative(share, abs);
  if (rel.startsWith('..')) throw new Error(`${abs} is outside the peer's share root ${share}`);
  return `flink://${key}/${rel}`;
}

export { sleep };
