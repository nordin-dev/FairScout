import { localized } from './i18n';
import * as en from './texts/en/report';
import * as bs from './texts/bs/report';
import * as tr from './texts/tr/report';
import * as zh from './texts/zh/report';

/** The texts of the PDF report in the chosen language; the English ones are in texts/en. */
export const report = localized({ en: en.report, bs: bs.report, tr: tr.report, zh: zh.report });
