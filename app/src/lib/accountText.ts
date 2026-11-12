import { localized, shortDate } from './i18n';
import * as en from './texts/en/account';
import * as bs from './texts/bs/account';
import * as tr from './texts/tr/account';
import * as zh from './texts/zh/account';

/** The texts of this module in the chosen language; the English ones are in texts/en. */
export const account = localized({ en: en.account, bs: bs.account, tr: tr.account, zh: zh.account });
export const myPicks = localized({ en: en.myPicks, bs: bs.myPicks, tr: tr.myPicks, zh: zh.myPicks });

/** "12 Nov 2026" from an ISO date and time, in the chosen language. */
export function pickDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : shortDate(date);
}
