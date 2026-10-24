// Checks src/http-client.ts's upload URL with a plain `node scripts/check-upload.mjs` (type
// stripping, no server): the source and game path reach the server as they are, spaces and a
// literal `+` included, when decoded the way the server's `http::query_value` does (`%XX` only,
// `+` kept). Then `upload` itself, over a mocked XMLHttpRequest: the URL it opens, the raw body,
// progress, the staged path, the server's error and an abort.

import assert from "node:assert/strict";

const c = await import("../src/http-client.ts");

// The server's decoding (crates/ps5-dump-forge-server/src/http.rs): `%XX` bytes, UTF-8; `+` stays.
function serverQuery(url, key) {
  const q = url.slice(url.indexOf("?") + 1);
  for (const pair of q.split("&")) {
    const i = pair.indexOf("=");
    if (i < 0 || pair.slice(0, i) !== key) continue;
    const v = pair.slice(i + 1);
    const bytes = [];
    for (let j = 0; j < v.length; j++) {
      if (v[j] === "%") {
        bytes.push(parseInt(v.slice(j + 1, j + 3), 16));
        j += 2;
      } else bytes.push(...Buffer.from(v[j]));
    }
    return Buffer.from(bytes).toString("utf8");
  }
  return null;
}

const cases = [
  ["/games/My Game.exfat", "data/a b.bin"],
  ["/games/C++ Game+1.ffpkg", "sce_sys/x+y z.png"],
  ["/data/a&b=c#d%20e?.exfat", "dir/100% & more=#1?.txt"],
  ["/data/Игра 日本.ffpkg", "données/ファイル.bin"],
];
for (const [source, path] of cases) {
  const url = c.uploadUrl(source, path);
  assert.ok(url.startsWith("/api/edit_upload?"), url);
  assert.ok(!url.includes(" ") && !/[?&](source|path)=[^&]*\+/.test(url), `raw space or + in ${url}`);
  assert.equal(serverQuery(url, "source"), source, url);
  assert.equal(serverQuery(url, "path"), path, url);
}

// upload() over a mocked XHR.
let last = null;
const all = [];
globalThis.XMLHttpRequest = class {
  upload = {};
  status = 0;
  statusText = "";
  responseText = "";
  open(method, url) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(k, v) {
    this.type = [k, v];
  }
  send(body) {
    this.body = body;
    last = this;
    all.push(this);
  }
  abort() {
    this.onabort?.();
  }
};
const file = { size: 5 };
const answer = (status, body) => {
  last.status = status;
  last.responseText = JSON.stringify(body);
  last.onload();
};

let sent = [];
let p = c.upload("/games/My Game+.exfat", "a b/c+d.bin", file, (s, t) => sent.push([s, t]));
assert.equal(last.method, "POST");
assert.equal(last.url, c.uploadUrl("/games/My Game+.exfat", "a b/c+d.bin"));
assert.equal(serverQuery(last.url, "source"), "/games/My Game+.exfat");
assert.equal(serverQuery(last.url, "path"), "a b/c+d.bin");
assert.equal(last.body, file);
assert.deepEqual(last.type, ["Content-Type", "application/octet-stream"]);
last.upload.onprogress({ loaded: 3, total: 5, lengthComputable: true });
assert.deepEqual(sent, [[3, 5]]);
answer(200, { path: "/games/My Game+.exfat.forge-upload-1.part/a b/c+d.bin" });
assert.equal(await p, "/games/My Game+.exfat.forge-upload-1.part/a b/c+d.bin");

p = c.upload("/g.exfat", "../x", file);
answer(400, { error: "bad game path" });
await assert.rejects(p, (e) => e === "bad game path");

const abort = new AbortController();
p = c.upload("/g.exfat", "x", file, undefined, abort.signal);
abort.abort();
await assert.rejects(p, (e) => e === "aborted");
const pre = new AbortController();
pre.abort();
await assert.rejects(c.upload("/g.exfat", "x", file, undefined, pre.signal), (e) => e === "aborted");

// connectUpload(): 8 MiB chunks, all in flight at once (up to 4), finished by whichever ends last.
const reply = (x, status, body) => {
  x.status = status;
  x.responseText = JSON.stringify(body);
  x.onload();
};
const tick = () => new Promise((r) => setTimeout(r, 0));
const big = new Blob([new Uint8Array(20 << 20)]);
all.length = 0;
sent = [];
p = c.connectUpload("/data/In", "a b+.bin", big, (s, t) => sent.push([s, t]));
await tick();
assert.equal(all.length, 3);
const ids = new Set(all.map((x) => serverQuery(x.url, "id")));
assert.equal(ids.size, 1);
assert.deepEqual(all.map((x) => serverQuery(x.url, "offset")), ["0", "8388608", "16777216"]);
assert.ok(all.every((x) => serverQuery(x.url, "size") === String(20 << 20) && serverQuery(x.url, "name") === "a b+.bin"));
assert.deepEqual(all.map((x) => x.body.size), [8 << 20, 8 << 20, 4 << 20]);
all[1].upload.onprogress({ loaded: 1000, total: 8 << 20, lengthComputable: true });
assert.deepEqual(sent.at(-1), [1000, 20 << 20]);
reply(all[2], 200, { done: false });
reply(all[1], 200, { done: false });
reply(all[0], 200, { path: "/data/In/a b+.bin", done: true });
assert.equal(await p, "/data/In/a b+.bin");
assert.deepEqual(sent.at(-1), [20 << 20, 20 << 20]);

// A failed chunk: the others are aborted, the server told to drop the part.
all.length = 0;
p = c.connectUpload("/data/In", "x.bin", big);
await tick();
reply(all[0], 409, { error: "/data/In/x.bin: already exists" });
await assert.rejects(p, (e) => e === "/data/In/x.bin: already exists");
assert.ok(all.some((x) => serverQuery(x.url, "cancel") === "1"));

console.log("upload: ok");
