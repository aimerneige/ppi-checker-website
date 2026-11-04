/**
 * Minimal, typed i18n.
 *
 * Adding a language: create `src/i18n/locales/<code>.ts` with
 *   `export default { code, name, defaultUnit, messages } satisfies LocaleDef;`
 * It is discovered automatically (import.meta.glob); TypeScript enforces that every key
 * from the English source exists. Missing strings at runtime fall back to English.
 */
import en from './locales/en';

type DeepStrings<T> = { [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]> };
export type Messages = DeepStrings<typeof en.messages>;

type Path<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Path<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Path<Messages>;

export interface LocaleDef {
  /** BCP-47 tag, also used as <html lang>. */
  code: string;
  /** Endonym shown in the language menu. */
  name: string;
  /** Preferred measurement unit for first-time visitors. */
  defaultUnit: 'cm' | 'in';
  messages: Messages;
}

const modules = import.meta.glob<{ default: LocaleDef }>('./locales/*.ts', { eager: true });
const ORDER = ['zh-CN', 'ja', 'en'];
export const LOCALES: LocaleDef[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => {
    const ia = ORDER.indexOf(a.code);
    const ib = ORDER.indexOf(b.code);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.code.localeCompare(b.code);
  });

const STORAGE_KEY = 'ppi.locale';
let current: LocaleDef = en;
const listeners = new Set<() => void>();

export function detectLocale(): LocaleDef {
  const saved = localStorage.getItem(STORAGE_KEY);
  const byCode = (c: string) => LOCALES.find((l) => l.code.toLowerCase() === c.toLowerCase());
  if (saved && byCode(saved)) return byCode(saved)!;
  for (const lang of navigator.languages ?? [navigator.language]) {
    const exact = byCode(lang);
    if (exact) return exact;
    const base = lang.split('-')[0].toLowerCase();
    const partial = LOCALES.find((l) => l.code.split('-')[0].toLowerCase() === base);
    if (partial) return partial;
  }
  return en;
}

export function setLocale(code: string, persist = true) {
  const next = LOCALES.find((l) => l.code === code);
  if (!next) return;
  current = next;
  if (persist) localStorage.setItem(STORAGE_KEY, code);
  document.documentElement.lang = code;
  listeners.forEach((fn) => fn());
}

export const getLocale = () => current;
export const onLocaleChange = (fn: () => void) => listeners.add(fn);

function lookup(messages: unknown, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Translate a key; `{name}` placeholders are replaced from `vars`. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const raw = lookup(current.messages, key) ?? lookup(en.messages, key) ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : raw;
}

/** Same as `t` but for keys built at runtime (e.g. preset ids). */
export const tDynamic = (key: string, vars?: Record<string, string | number>) =>
  t(key as MessageKey, vars);

export const hasKey = (key: string) => lookup(current.messages, key) !== undefined || lookup(en.messages, key) !== undefined;

const nfCache = new Map<string, Intl.NumberFormat>();
export function fmt(n: number, maxDigits = 0, minDigits = 0): string {
  const k = `${current.code}|${maxDigits}|${minDigits}`;
  let nf = nfCache.get(k);
  if (!nf) {
    nf = new Intl.NumberFormat(current.code, {
      maximumFractionDigits: maxDigits,
      minimumFractionDigits: minDigits,
    });
    nfCache.set(k, nf);
  }
  return nf.format(n);
}
