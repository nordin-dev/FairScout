import { useSyncExternalStore } from 'react';

/** The languages of the interface. English is the source; a text missing in another language falls back to it. */
export const LANGS = ['en', 'bs', 'tr', 'zh'] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAMES: Record<Lang, string> = { en: 'English', bs: 'Bosanski', tr: 'Türkçe', zh: '中文' };
export const LANG_SHORT: Record<Lang, string> = { en: 'EN', bs: 'BS', tr: 'TR', zh: '中文' };
const HTML_LANG: Record<Lang, string> = { en: 'en', bs: 'bs', tr: 'tr', zh: 'zh-Hans' };
const KEY = 'fairscout.lang';

const isLang = (value: unknown): value is Lang => LANGS.some((l) => l === value);

function stored(): Lang {
  try {
    const value = window.localStorage.getItem(KEY);
    return isLang(value) ? value : 'en';
  } catch {
    return 'en';
  }
}

let lang: Lang = stored();
const listeners = new Set<() => void>();

function apply(): void {
  if (typeof document !== 'undefined') document.documentElement.lang = HTML_LANG[lang];
}
apply();

export const getLang = (): Lang => lang;

/** Chooses the language and remembers it in this browser. */
export function setLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // Storage can be blocked; the choice then lasts until the page is closed.
  }
  apply();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const useLang = (): Lang => useSyncExternalStore(subscribe, () => lang);

/**
 * The shape a translation must have: the same keys and the same function arguments as the English
 * object, with every text widened to `string`. Values that are not shown (the `value` of an option,
 * numbers) must be kept exactly as in English.
 */
export type Loose<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => Loose<R>
  : T extends string
    ? string
    : T extends readonly (infer E)[]
      ? readonly Loose<E>[]
      : T extends object
        ? { readonly [K in keyof T]: Loose<T[K]> }
        : T;

/**
 * One text object that follows the chosen language. Every read goes to the object of the language
 * chosen at that moment, so `t.title(3)` needs no change in the code that uses it. Read texts while
 * drawing, not once at module load: a text kept in a module constant stays in the language it was read in.
 */
export function localized<T extends object>(table: { en: T } & Record<Exclude<Lang, 'en'>, Loose<T>>): T {
  return new Proxy(table.en, {
    get(target, prop, receiver) {
      const own = table[lang] as Record<PropertyKey, unknown>;
      return prop in own ? own[prop] : Reflect.get(target, prop, receiver);
    },
  });
}

const MONTHS_SHORT: Record<Lang, readonly string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  bs: ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
  zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
};
const MONTHS_LONG: Record<Lang, readonly string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  bs: ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'],
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  zh: MONTHS_SHORT.zh,
};

/** The short name of a month (0 = January) in the chosen language: "Jun", "jun", "Haz", "6月". Written out here because browsers disagree on some of them. */
export const monthShort = (month: number): string => MONTHS_SHORT[lang][month] ?? '';

/** The full name of a month (0 = January) in the chosen language. */
export const monthLong = (month: number): string => MONTHS_LONG[lang][month] ?? '';

/** Day, short month and year as English writes them ("12 Nov 2026"), with the month in the chosen language. */
export const dayMonthYearWords = (day: number, month: number, year: number | string): string =>
  lang === 'zh' ? `${year}年${month + 1}月${day}日` : `${day} ${monthShort(month)} ${year}`;

/** Short month and year ("Jun 2027") in the chosen language. */
export const monthYearWords = (month: number, year: number | string): string =>
  lang === 'zh' ? `${year}年${month + 1}月` : `${monthShort(month)} ${year}`;

/** A date as day, short month and year in the chosen language, in local time. */
export const shortDate = (date: Date): string => dayMonthYearWords(date.getDate(), date.getMonth(), date.getFullYear());
