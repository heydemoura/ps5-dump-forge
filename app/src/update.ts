// The update check, once per start (UpdateToast.tsx): GitHub's latest release, when it is newer
// than this build and carries this platform's file. No setting and nothing stored; any failure
// is silence. No runtime imports, so a plain `node` can drive it (scripts/check-update.mjs).

export const LATEST_URL = "https://api.github.com/repos/quer3q/ps5-dump-forge/releases/latest";
export const CHECK_TIMEOUT_MS = 10000;

/** What this build updates to: its version and the release file's suffix (after
 * `ps5-dump-forge-<v>-`), from the transport's `updateTarget`. */
export interface Target {
  version: string;
  asset: string;
}

/** `startUpdate`'s rejection when the new version never answered (the UI words it). */
export const UPDATE_TIMEOUT = "update-timeout";
export type UpdateTimeout = typeof UPDATE_TIMEOUT;

/** A release tag `vX.Y.Z` as its version, else null (prereleases and anything else). At most 9
 * digits a part: what the server's `self_update` takes. */
export function tagVersion(tag: unknown): string | null {
  return typeof tag === "string" && /^v\d{1,9}\.\d{1,9}\.\d{1,9}$/.test(tag) ? tag.slice(1) : null;
}

/** `X.Y.Z` newer than `current` (`X.Y.Z`, maybe `-pre4` or `+build`): by number, and a current
 * prerelease is older than its release. False when `current` doesn't parse. */
export function isNewer(latest: string, current: string): boolean {
  const l = /^(\d+)\.(\d+)\.(\d+)$/.exec(latest);
  const c = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.exec(current);
  if (!l || !c) return false;
  for (let i = 1; i <= 3; i++) if (+l[i] !== +c[i]) return +l[i] > +c[i];
  return c[4] !== undefined;
}

/** The release file for a version: `ps5-dump-forge-<v>-<asset>`. */
export function assetName(version: string, asset: string): string {
  return `ps5-dump-forge-${version}-${asset}`;
}

/** The newer version to offer, from a `releases/latest` body; null unless its tag is a plain
 * version newer than ours and its assets list our file by its exact name, uploaded and not
 * empty (so the download can't 404 or come back empty). */
export function offer(release: unknown, target: Target): string | null {
  const r = release as { tag_name?: unknown; assets?: unknown } | null;
  const v = tagVersion(r?.tag_name);
  if (!v || !isNewer(v, target.version) || !Array.isArray(r?.assets)) return null;
  const want = assetName(v, target.asset);
  const ok = (a: unknown) => {
    const f = a as { name?: unknown; state?: unknown; size?: unknown } | null;
    return f?.name === want && f.state === "uploaded" && typeof f.size === "number" && f.size > 0;
  };
  return r.assets.some(ok) ? v : null;
}

/** Ask GitHub (no cookies, no cache, `CHECK_TIMEOUT_MS` for the whole answer): the version to
 * offer, or null on anything else. Never rejects. */
export async function checkUpdate(target: Target, f: typeof fetch = (i, o) => fetch(i, o)): Promise<string | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), CHECK_TIMEOUT_MS);
  try {
    const res = await f(LATEST_URL, { cache: "no-store", credentials: "omit", signal: abort.signal });
    return res.ok ? offer(await res.json(), target) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
