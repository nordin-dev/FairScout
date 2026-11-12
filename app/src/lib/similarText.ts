import { localized } from './i18n';
import * as en from './texts/en/similar';
import * as bs from './texts/bs/similar';
import * as tr from './texts/tr/similar';
import * as zh from './texts/zh/similar';

/** The texts of section 01 in the chosen language; the English ones are in texts/en. */
export const similar = localized({ en: en.similar, bs: bs.similar, tr: tr.similar, zh: zh.similar });
