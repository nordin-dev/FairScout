import { getLang } from './i18n';
import { data as bs } from './texts/bs/data';
import { data as tr } from './texts/tr/data';
import { data as zh } from './texts/zh/data';

const TABLES: Record<string, Record<string, string>> = { bs, tr, zh };
const NUMBER = /\d+(?:\.\d+)?/;

/**
 * A short English text from a data file (a model's reason, a position, a difference between two
 * players) in the chosen language; unchanged when there is no translation. A text with a number is
 * looked up with its first number written as {n}: "older by 2 years" is the key "older by {n} years".
 */
export function dataText(english: string): string {
  const table = TABLES[getLang()];
  if (!table) return english;
  const exact = table[english];
  if (exact !== undefined) return exact;
  const number = NUMBER.exec(english)?.[0];
  const template = number === undefined ? undefined : table[english.replace(NUMBER, '{n}')];
  return template === undefined || number === undefined ? english : template.replace('{n}', number);
}
