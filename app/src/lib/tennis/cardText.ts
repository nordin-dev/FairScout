import { localized } from '../i18n';
import * as en from '../texts/en/tennisCard';
import * as bs from '../texts/bs/tennisCard';
import * as tr from '../texts/tr/tennisCard';
import * as zh from '../texts/zh/tennisCard';

/** The texts of this module in the chosen language; the English ones are in texts/en. */
export const tennisCard = localized({ en: en.tennisCard, bs: bs.tennisCard, tr: tr.tennisCard, zh: zh.tennisCard });
