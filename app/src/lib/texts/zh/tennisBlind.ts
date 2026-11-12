import type { Loose } from '../../i18n';
import type * as en from '../en/tennisBlind';

/** 网球盲选的全部界面文字。 */
export const tennisBlind: Loose<typeof en.tennisBlind> = {
  kicker: '01 — 盲选',
  question: '你在找什么样的球员？',
  ageLabel: '年龄',
  ages: [
    { value: '19', label: '19 岁及以下' },
    { value: '20', label: '21 岁以下' },
  ],
  hiddenLabel: '隐藏程度',
  hiddens: [
    { value: '150', label: '排名 150 开外' },
    { value: '250', label: '排名 250 开外' },
    { value: '400', label: '排名 400 开外' },
  ],
  mattersLabel: '最看重',
  mattersHint: '选两项',
  matters: [
    { value: 'wins', label: '能赢球' },
    { value: 'level', label: '比赛水平高' },
    { value: 'rise', label: '排名上升快' },
  ],
  countPlural: '名球员符合',
  tooFew: (n: number) => `${n} 名球员符合。需要三名：请放宽年龄或排名限制。`,
  loadingPlayers: '正在加载球员…',
  showThree: '给我三名，不看名字 →',
  title: '三名球员。没有名字。选一个。',
  ageWords: (maxAge: number) => (maxAge === 20 ? '21 岁以下' : `${maxAge} 岁及以下`),
  summary: (ageWords: string, hidden: number, matters: string[]) =>
    [ageWords, `排名 ${hidden} 开外`, ...matters].join(' · '),
  matterWords: { wins: '能赢球', level: '比赛水平高', rise: '排名上升快' },
  change: '修改',
  dimLabels: { wins: '胜率', level: '比赛水平', rise: '上升速度' },
  caption: '前景 = 模型估计的三年内进入前 100 的可能性。满分 100，与候选池中的其他球员相比。',
  candidate: (letter: string) => `球员 ${letter}`,
  facts: (age: number, hand: 'Right' | 'Left' | null) =>
    `${age} 岁${hand === null ? '' : hand === 'Right' ? ' · 右手持拍' : ' · 左手持拍'}`,
  pick: '选这名球员',
  pickLabel: (letter: string) => `选球员 ${letter}`,
  labelRanking: '排名',
  labelRecord: '胜负',
  labelOutlook: '前景',
  ranking: (rank: number) => `第 ${rank} 位`,
  record: (wins: number, losses: number) => `${wins}–${losses}`,
  yourPick: '你的选择',
  tagModel: '模型之选',
  tagRanking: '排名最高',
  verdictAgree: (letter: string) => `你和模型的选择一致：${letter}。`,
  verdictAgreeSub: '看的是他做了什么，而不是他是谁。他已在你的名单上。',
  verdictDisagree: (you: string, model: string) => `你选了 ${you}，模型选了 ${model}。`,
  verdictDisagreeSub: '两人都会进入你的名单。分歧所在，值得亲自去看一趟。',
  seeWhy: '查看原因 →',
  reasonLabel: (model: string, scout: string) => `${model} 与 ${scout} 对比`,
  reasonCandidate: (letter: string, name: string) => `${letter} · ${name}`,
  reasonRows: {
    tier: '前景',
    rank: '排名',
    winRate: '胜率，%',
    age: '年龄',
    top200: '战胜前 200 名球员的场次',
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
    rank: '排名更高',
    winRate: '胜率更高',
    age: '年龄更小',
    top200: '战胜前 200 名球员的场次更多',
  },
  reasonBehind: {
    rank: '排名更低',
    winRate: '胜率更低',
    age: '年龄更大',
    top200: '战胜前 200 名球员的场次更少',
  },
  reasonRowsAhead: (model: string, ahead: string, behind: string) =>
    ahead && behind ? `${model} ${ahead}，但${behind}。` : ahead ? `${model} ${ahead}。` : behind ? `${model} ${behind}。` : '',
  reasonList: (items: string[]) =>
    items.length < 2 ? items.join('') : `${items.slice(0, -1).join('、')}和${items[items.length - 1]}`,
  errorFile: 'tennis.json',
};
