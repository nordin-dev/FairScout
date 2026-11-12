import { localized } from './i18n';
import * as en from './texts/en/main';
import * as bs from './texts/bs/main';
import * as tr from './texts/tr/main';
import * as zh from './texts/zh/main';

/** The texts of this module in the chosen language; the English ones are in texts/en. */
export const frame = localized({ en: en.frame, bs: bs.frame, tr: tr.frame, zh: zh.frame });
export const states = localized({ en: en.states, bs: bs.states, tr: tr.states, zh: zh.states });
export const tier = localized({ en: en.tier, bs: bs.tier, tr: tr.tier, zh: zh.tier });
export const player = localized({ en: en.player, bs: bs.player, tr: tr.player, zh: zh.player });
export const radar = localized({ en: en.radar, bs: bs.radar, tr: tr.radar, zh: zh.radar });
export const plot = localized({ en: en.plot, bs: bs.plot, tr: tr.plot, zh: zh.plot });
export const time = localized({ en: en.time, bs: bs.time, tr: tr.time, zh: zh.time });
export const evidence = localized({ en: en.evidence, bs: bs.evidence, tr: tr.evidence, zh: zh.evidence });
