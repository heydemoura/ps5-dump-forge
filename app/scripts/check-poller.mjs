// Checks src/http-client.ts's snapshot diffing with a plain `node scripts/check-poller.mjs`
// (type stripping, no server): restore, stages/progress/log/done once, a new job, a job dropped
// from the server's history and a payload restart; then src/jobs.ts's reducer: a restart's reused
// id starts blank, the current step follows the stages in order, and the job bar only grows and
// is full only on success.

import assert from "node:assert/strict";

const c = await import("../src/http-client.ts");
const got = [];
for (const e of ["jobs://restore", "job://stages", "job://progress", "job://log", "job://done"]) await c.listen(e, (p) => got.push([e, p]));
const take = () => got.splice(0);

const request = { source: "/data/g", format: "exfat", output: "/data/g.exfat", compression_threads: 3, inner: null, remove_backport: false, full_verify: false, kraken_level: "fast", ffpfsc_level: 6 };
const job = (id, over = {}) => ({ id, request, progress: null, stages: [], done: null, log: [], log_total: 0, ...over });
const prog = (id, done) => ({ kind: "progress", job: id, stage: "write", done, total: 100 });
const ok = (id) => ({ kind: "done", job: id, result: { Ok: { output: request.output, bytes: 1, files: 1, checks: [] } } });

// First snapshot: the whole list, replaced.
c.applySnapshot({ instance: "A", jobs: [job(1), job(2, { done: ok(2) })] });
let ev = take();
assert.equal(ev.length, 1);
assert.equal(ev[0][0], "jobs://restore");
assert.equal(ev[0][1].replace, true);
assert.deepEqual(ev[0][1].jobs.map((j) => j.id), [1, 2]);

// Progress when it changes, only new log lines (by log_total, past the 200-line window), done once.
c.applySnapshot({ instance: "A", jobs: [job(1, { progress: prog(1, 10), log: ["a", "b"], log_total: 2 }), job(2, { done: ok(2) })] });
ev = take();
assert.deepEqual(ev.map(([e]) => e), ["job://progress", "job://log", "job://log"]);
c.applySnapshot({ instance: "A", jobs: [job(1, { progress: prog(1, 10), log: ["c", "d", "e"], log_total: 5 }), job(2, { done: ok(2) })] });
ev = take();
assert.deepEqual(ev.map(([, p]) => p.line), ["c", "d", "e"]);
c.applySnapshot({ instance: "A", jobs: [job(1, { progress: prog(1, 100), done: ok(1), log: ["e"], log_total: 5 }), job(2, { done: ok(2) })] });
ev = take();
assert.deepEqual(ev.map(([e]) => e), ["job://progress", "job://done"]);
c.applySnapshot({ instance: "A", jobs: [job(1, { progress: prog(1, 100), done: ok(1), log: ["e"], log_total: 5 }), job(2, { done: ok(2) })] });
assert.deepEqual(take(), [], "nothing repeats");

// A new job (another browser's Build) arrives whole.
c.applySnapshot({ instance: "A", jobs: [job(1, { done: ok(1) }), job(2, { done: ok(2) }), job(3, { progress: prog(3, 5) })] });
ev = take();
assert.equal(ev.length, 1);
assert.equal(ev[0][1].replace, false);
assert.deepEqual(ev[0][1].jobs.map((j) => j.id), [3]);

// Job 3 finishes and is dropped from the server's history before a poll sees it finish:
// it ends with GONE, once. Finished jobs 1 and 2 going away emit nothing.
c.applySnapshot({ instance: "A", jobs: [job(4)] });
ev = take();
const done = ev.filter(([e]) => e === "job://done");
assert.deepEqual(done.map(([, p]) => p), [{ kind: "done", job: 3, result: { Err: c.GONE } }]);
assert.deepEqual(ev.filter(([e]) => e === "jobs://restore").map(([, p]) => p.jobs.map((j) => j.id)), [[4]]);
c.applySnapshot({ instance: "A", jobs: [job(4)] });
assert.deepEqual(take(), [], "a dropped id is forgotten, not ended twice");
// The payload restarted (new instance): the whole list is rebuilt, nothing ends with GONE.
c.applySnapshot({ instance: "B", jobs: [job(1)] });
ev = take();
assert.deepEqual(ev.map(([e, p]) => [e, p.replace]), [["jobs://restore", true]]);
assert.deepEqual(ev[0][1].jobs.map((j) => j.id), [1]);

// The stage list: one job://stages event when it first shows, before that snapshot's progress.
const stages = ["scan", "preflight", "check", "write", "verify", "finalize"];
c.applySnapshot({ instance: "B", jobs: [job(1, { stages, progress: { ...prog(1, 1), stage: "scan" } })] });
ev = take();
assert.deepEqual(ev.map(([e]) => e), ["job://stages", "job://progress"]);
assert.deepEqual(ev[0][1], { kind: "stages", job: 1, stages });
c.applySnapshot({ instance: "B", jobs: [job(1, { stages, progress: prog(1, 2) })] });
assert.deepEqual(take().map(([e]) => e), ["job://progress"], "stages are sent once");

console.log("http-client poller: ok (restore, stages and diffs once, new job, dropped job ends once, restart rebuilds)");

// ---- the reducer: a restart reuses ids, so a replacement keeps nothing of the old job ----
const { jobsReducer } = await import("../src/jobs.ts");
let list = jobsReducer([], { type: "restore", at: 0, e: { replace: true, jobs: [job(1, { progress: prog(1, 100), done: ok(1), log: ["old"], log_total: 1 })] } });
assert.ok(list[0].result && list[0].shown === 1);
c.applySnapshot({ instance: "C", jobs: [job(1, { progress: prog(1, 5), log: ["new"], log_total: 1 })] });
for (const [e, p] of take()) if (e === "jobs://restore") list = jobsReducer(list, { type: "restore", at: 1, e: p });
assert.equal(list.length, 1);
assert.equal(list[0].result, undefined, "the new job 1 is running, not the old one's result");
assert.equal(list[0].shown, 0.05);
assert.deepEqual(list[0].log, ["new"]);
console.log("jobs reducer: ok (a restart's reused id starts from blank)");

// The current step (src/jobs.ts): stages may come after the first progress; a stage id listed
// twice is found forward, from the step before it.
{
  const at = (jobs, stage) => jobsReducer(jobs, { type: "progress", e: { kind: "progress", job: 9, stage, done: 0, total: 1 }, at: 0 });
  let s9 = at([], "scan");
  assert.equal(s9[0].step, undefined);
  s9 = jobsReducer(s9, { type: "stages", e: { kind: "stages", job: 9, stages: ["scan", "verify", "write", "verify", "finalize"] } });
  assert.equal(s9[0].step, 0);
  s9 = at(at(at(s9, "verify"), "write"), "verify");
  assert.equal(s9[0].step, 3, "the second verify");
  console.log("jobs: steps follow the stage list in order");
}

// The job bar (src/jobs.ts): never back, short of full until the job succeeds, even when
// core's estimate is met before its last pass (R1's plateau, fixed in core; this only guards).
const step = (jobs, stage, done, total, at = 0) => jobsReducer(jobs, { type: "progress", e: { kind: "progress", job: 1, stage, done, total }, at });
let js = jobsReducer([], { type: "started", id: 1, request });
const seen = [];
for (const [stage, done, total] of [
  ["preflight", 25, 125],
  ["measure", 123, 434],
  ["write", 123, 243],
  ["write", 131, 243],
  ["verify", 139, 243],
  ["verify", 243, 243],
  ["finalize", 243, 243],
]) {
  js = step(js, stage, done, total);
  seen.push(js[0].shown);
}
assert.deepEqual(seen, [...seen].sort((x, y) => x - y), "the bar only grows");
assert.ok(seen.every((f) => f < 1), `short of full before done: ${seen}`);
assert.equal(jobsReducer(js, { type: "done", e: ok(1) })[0].shown, 1, "done Ok: full");
console.log(`jobs: one bar ${seen.map((f) => Math.floor(100 * f)).join(" -> ")}%, full only on success`);
