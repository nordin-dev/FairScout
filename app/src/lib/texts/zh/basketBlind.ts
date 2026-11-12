import type { Loose } from '../../i18n';
import type * as en from '../en/basketBlind';

/** 篮球盲选的全部界面文字。 */
export const basketBlind: Loose<typeof en.basketBlind> = {
  kicker: '01 — 盲选',
  question: '你在找什么样的球员？',
  positionLabel: '位置',
  positions: [
    { value: 'Any', label: '不限' },
    { value: 'Guard', label: '后卫' },
    { value: 'Forward', label: '前锋' },
    { value: 'Center', label: '中锋' },
  ],
  ageLabel: '年龄',
  ages: [
    { value: '21', label: '21 岁以下' },
    { value: '23', label: '23 岁以下' },
  ],
  hiddenLabel: '隐藏程度',
  hiddens: [
    { value: '18', label: '场均不足 18 分钟' },
    { value: '12', label: '场均不足 12 分钟' },
    { value: '8', label: '场均不足 8 分钟' },
  ],
  mattersLabel: '最看重',
  mattersHint: '选两项',
  matters: [
    { value: 'scoring', label: '得分' },
    { value: 'impact', label: '全面影响力' },
    { value: 'trust', label: '教练的信任' },
  ],
  countPlural: '名球员符合',
  tooFew: (n: number) => `${n} 名球员符合。需要三名：请放宽位置、年龄或出场时间的限制。`,
  loadingPlayers: '正在加载球员…',
  showThree: '给我三名，不看名字 →',
  title: '三名球员。没有名字。选一个。',
  summary: (position: string, age: string, hidden: number, matters: string[]) =>
    [position === 'Any' ? '位置不限' : position, age, `场均不足 ${hidden} 分钟`, ...matters].join(' · '),
  matterWords: { scoring: '得分', impact: '全面影响力', trust: '教练的信任' },
  change: '修改',
  dimLabels: { scoring: '得分', impact: '全面影响力', trust: '教练的信任' },
  caption: (minutes: number) =>
    `前景 = 模型估计的三个赛季内成为轮换球员（场均 ${minutes} 分钟）的可能性。满分 100，与候选池中的其他球员相比。`,
  candidate: (letter: string) => `球员 ${letter}`,
  facts: (position: string | null, age: number, height: number | null) =>
    [position, `${age} 岁`, height === null ? null : `${height} cm`].filter(Boolean).join(' · '),
  pick: '选这名球员',
  pickLabel: (letter: string) => `选球员 ${letter}`,
  labelMinutes: '出场时间',
  labelPoints: '得分',
  labelOutlook: '前景',
  perGame: (n: number) => `场均 ${n.toFixed(1)}`,
  yourPick: '你的选择',
  tagModel: '模型之选',
  tagMinutes: '出场时间最多',
  verdictAgree: (letter: string) => `你和模型的选择一致：${letter}。`,
  verdictAgreeSub: '看的是他做了什么，而不是他是谁。他已在你的名单上。',
  verdictDisagree: (you: string, model: string) => `你选了 ${you}，模型选了 ${model}。`,
  verdictDisagreeSub: '两人都会进入你的名单。分歧所在，值得亲自去看一趟。',
  seeWhy: '查看原因 →',
  reasonLabel: (model: string, scout: string) => `${model} 与 ${scout} 对比`,
  reasonCandidate: (letter: string, name: string) => `${letter} · ${name}`,
  reasonRows: {
    tier: '前景',
    mpg: '场均出场时间',
    ppg: '场均得分',
    pir40: '每 40 分钟效率值',
    age: '年龄',
  },
  noValue: '—',
  reasonAheadMark: '✓',
  reasonAheadWord: '领先',
  reasonAheadNote: '✓ = 该项领先',
  reasonTiers: (model: string, modelTier: string, scout: string, scoutTier: string) =>
    modelTier === scoutTier
      ? `${model} 和 ${scout} 的前景都是 ${modelTier} 级。`
      : `${model} 的前景是 ${modelTier} 级，${scout} 的前景是 ${scoutTier} 级。`,
  reasonTiersBetter: (model: string, modelTier: string, scout: string, scoutTier: string) =>
    `模型更看好 ${model} 的前景：${modelTier} 级，而 ${scout} 是 ${scoutTier} 级。`,
  reasonScoreHigher: (model: string) => `在同一级别内，模型给 ${model} 的评分更高。`,
  reasonDrivers: (model: string, items: string[]) => `模型在 ${model} 身上看到的：${items.join(' · ')}。`,
  reasonAhead: {
    mpg: '出场时间更多',
    ppg: '得分更多',
    pir40: '效率值更高',
    age: '年龄更小',
  },
  reasonBehind: {
    mpg: '出场时间更少',
    ppg: '得分更少',
    pir40: '效率值更低',
    age: '年龄更大',
  },
  reasonRowsAhead: (model: string, ahead: string, behind: string) =>
    ahead && behind ? `${model} ${ahead}，但${behind}。` : ahead ? `${model} ${ahead}。` : behind ? `${model} ${behind}。` : '',
  reasonList: (items: string[]) =>
    items.length < 2 ? items.join('') : `${items.slice(0, -1).join('、')}和${items[items.length - 1]}`,
  errorFile: 'basketball.json',
};
