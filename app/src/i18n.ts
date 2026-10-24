// UI languages: English (the fallback) and the translations in `locales/`, one file per
// language. The system languages pick one until the About tab's selector does; localStorage
// keeps that choice (the one stored choice, by user decision), and a page that can't read or
// write it uses the system languages.
// `locales/en.tsx` is the source: its shape is `Messages`, and every other language file is
// typed as it, so tsc fails on a missing key or a different function signature. A language is
// loaded (its own chunk) before the app renders (`initLang`) or before a switch shows it.
// Components read theirs with `useMessages().<file>`, which re-renders on a switch in every
// React root (dialogs and the picker mount their own); code outside React uses `msg()` at call
// time, never at module load.
//
// To add a language: copy locales/en.tsx to locales/<tag>.tsx, translate it (plural forms per
// `Intl.PluralRules`), and add its line below.

import { useSyncExternalStore } from "react";

// English is in the main bundle (the fallback can't fail to load); the others are chunks.
// ponytail: en.tsx imports num/plural/dotted back from here, a cycle that is safe while no
// message runs at module load.
import en, { type Messages } from "./locales/en";

/** `numbers`: the Intl locale for digits when it isn't the tag itself (Arabic keeps Latin
 * digits, like the paths, versions and title IDs around them). */
type Info = { name: string; load: () => Promise<{ default: Messages }>; rtl?: boolean; numbers?: string; tag?: string };

/** Each language in its own words (the selector, in this order), its messages, and `rtl` for a
 * right-to-left script (the page gets `dir="rtl"`; styles.css flips what doesn't flip itself), and
 * `tag` where `<html lang>` needs more than the key (CJK glyphs and speech voices follow it). */
const LANGUAGES = {
  en: { name: "English", load: async () => ({ default: en }) },
  ru: { name: "Русский", load: () => import("./locales/ru") },
  zh: { name: "简体中文", load: () => import("./locales/zh"), tag: "zh-Hans" },
  de: { name: "Deutsch", load: () => import("./locales/de") },
  es: { name: "Español", load: () => import("./locales/es") },
  fr: { name: "Français", load: () => import("./locales/fr") },
  ja: { name: "日本語", load: () => import("./locales/ja") },
  pt: { name: "Português (Brasil)", load: () => import("./locales/pt"), tag: "pt-BR" },
  it: { name: "Italiano", load: () => import("./locales/it") },
  ko: { name: "한국어", load: () => import("./locales/ko") },
  ar: { name: "العربية", load: () => import("./locales/ar"), rtl: true, numbers: "ar-u-nu-latn" },
} satisfies Record<string, Info>;

export type Lang = keyof typeof LANGUAGES;

/** Each language in its own words, for the selector. */
export const LANGS = Object.fromEntries(Object.entries(LANGUAGES).map(([l, v]) => [l, v.name])) as Record<
  Lang,
  string
>;

const isLang = (v: string): v is Lang => Object.prototype.hasOwnProperty.call(LANGUAGES, v);

const KEY = "forge.lang";

function stored(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return v !== null && isLang(v) ? v : null;
  } catch {
    return null;
  }
}

function systemLangs(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length ? navigator.languages : navigator.language ? [navigator.language] : [];
}

/** A UI language for a BCP 47 tag: the same tag (`pt-BR`), else its language (`pt`). */
function match(tag: string): Lang | null {
  const t = tag.toLowerCase();
  const langs = Object.keys(LANGUAGES) as Lang[];
  return langs.find((l) => l.toLowerCase() === t) ?? langs.find((l) => l.toLowerCase() === t.split("-")[0]) ?? null;
}

/** The first system language the UI has, else English. */
function detect(): Lang {
  for (const tag of systemLangs()) {
    const l = match(tag);
    if (l) return l;
  }
  return "en";
}

let choice: Lang | null = stored();
let lang: Lang = choice ?? detect();
let messages: Messages | undefined;
const loaded = new Map<Lang, Messages>();
const subs = new Set<() => void>();
/** Bumped on every switch: `choice` can change while `lang` stays (System → English), and
 * `gameTitle` reads both. */
let version = 0;
/** The latest switch; an older one that loads later is dropped. */
let switchSeq = 0;

async function load(l: Lang): Promise<Messages> {
  let m = loaded.get(l);
  if (!m) loaded.set(l, (m = (await LANGUAGES[l].load()).default));
  return m;
}

function apply() {
  if (typeof document === "undefined") return;
  const info: Info = LANGUAGES[lang];
  document.documentElement.lang = info.tag ?? lang;
  document.documentElement.dir = info.rtl ? "rtl" : "ltr";
}

/** Loads the language in effect; English (bundled, never fails) if that fails. Await it
 * before the first render. */
export async function initLang(): Promise<void> {
  try {
    messages = await load(lang);
  } catch {
    // The page is English now; the selector says so (the stored choice stays for next time).
    if (choice) choice = "en";
    lang = "en";
    messages = en;
  }
  apply();
}

export const getLang = (): Lang => lang;
/** The selector's choice, or null while the system languages decide. */
export const getChoice = (): Lang | null => choice;

/** Choose a language, or null to follow the system again; shown once its file has loaded (a
 * file that can't load leaves the language as it was). */
export async function setLang(l: Lang | null): Promise<void> {
  const seq = ++switchSeq;
  const next = l ?? detect();
  const m = await load(next);
  if (seq !== switchSeq) return;
  choice = l;
  lang = next;
  messages = m;
  try {
    if (l) localStorage.setItem(KEY, l);
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode or blocked storage: the choice lasts until the page closes.
  }
  apply();
  version++;
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}

export function useLang(): Lang {
  useSyncExternalStore(subscribe, () => version);
  return lang;
}

/** The current language's messages; re-renders on a switch. */
export function useMessages(): Messages {
  useLang();
  return msg();
}

/** Outside React: the current language's messages (read at call time, never at module load). */
export function msg(): Messages {
  if (!messages) throw new Error("i18n: initLang() has not finished");
  return messages;
}

/** File extensions as running text: `.zip or .toml` (`or`: the language's word). */
export const dotted = (ext: string[], or: string) => ext.map((e) => `.${e}`).join(or);

const rules = new Map<Lang, Intl.PluralRules>();

/** The form for `n` in the current language: English uses one/other, Russian one/few/many. */
export function plural(n: number, forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }): string {
  let r = rules.get(lang);
  if (!r) rules.set(lang, (r = new Intl.PluralRules(lang)));
  return forms[r.select(n)] ?? forms.other;
}

/** A number in the current language's digits grouping and decimal mark, `digits` decimals. */
const numberFormats = new Map<string, Intl.NumberFormat>();

export function num(n: number, digits = 0): string {
  const info: Info = LANGUAGES[lang];
  const locale = info.numbers ?? lang;
  const key = `${locale}|${digits}`;
  let f = numberFormats.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    numberFormats.set(key, f);
  }
  return f.format(n);
}

/** The param.json tags a language means, best first: Chinese by script (zh-TW/HK/MO and
 * zh-Hant → zh-Hant, else zh-Hans), a bare or other-region tag with the region PS5 titles
 * usually carry (en-US, pt-BR, fr-FR; Spanish outside Spain es-419, else es-ES). */
function titleTags(tag: string): string[] {
  const [lang, region = ""] = tag.toLowerCase().split("-");
  if (lang === "zh") return [/^(tw|hk|mo|hant)$/.test(region) ? "zh-Hant" : "zh-Hans"];
  if (lang === "es") return [tag, region && region !== "es" ? "es-419" : "es-ES"];
  const usual: Record<string, string> = { en: "en-US", pt: "pt-BR", fr: "fr-FR" };
  return usual[lang] ? [tag, usual[lang]] : [tag];
}

/**
 * The game's title from param.json's `localizedParameters` in the UI's language (when chosen in
 * About), else the system languages, else English; else `fallback` (the default language's).
 * Components that call it re-render on a switch through their `useMessages`/`useLang`.
 */
export function gameTitle(names: Record<string, string> | null | undefined, fallback: string | null): string | null {
  if (names) {
    const tags = Object.keys(names);
    // Each wanted language in preference order: its exact tags first, then any region of it.
    for (const group of [...(choice ? [choice] : []), ...systemLangs(), "en-US"].map(titleTags))
      for (const same of [(t: string, w: string) => t === w, (t: string, w: string) => t.split("-")[0] === w.split("-")[0]])
        for (const w of group) {
          const hit = tags.find((t) => same(t.toLowerCase(), w.toLowerCase()));
          if (hit && names[hit]) return names[hit];
        }
  }
  return fallback;
}
