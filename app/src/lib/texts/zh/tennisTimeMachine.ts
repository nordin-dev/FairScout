import type { Loose } from '../../i18n';
import type * as en from '../en/tennisTimeMachine';

export const tennisTimeMachine: Loose<typeof en.tennisTimeMachine> = {
  kicker: '03 — 时光机',
  yearsLabel: '年份',
  loadingNote: '正在加载往年数据…',
  errorReason: '网球数据没有加载出来。',
  emptyTitle: '目前还没有可以检验的往年。',
  emptyLede: '一年结束三年后，才能检验。',
  emptyBlockTitle: '数据中没有往年。',
  emptyBlockText: '模型在往年上的检验在“证据”页。',
  openEvidence: '打开证据 →',
  evidencePath: '/evidence',
  thenTitle: (monthYear: string, n: number) => `现在是 ${monthYear}。这是模型选出的前 ${n} 名。`,
  thenLede: (date: string, pool: number) =>
    `${date} 的 ATP 排名：${pool} 名 21 岁以下、排名 101 至 1000 的球员。模型只见过更早的年份。`,
  revealedTitle: (hits: number, n: number) => `${n} 人中有 ${hits} 人在三年内进入前 100。`,
  revealedLede: (pool: number, poolHits: number) => `候选池全部 ${pool} 名球员中，有 ${poolHits} 人做到了。`,
  reveal: (monthYear: string) => `看看到 ${monthYear} 发生了什么 →`,
  hide: '再次隐藏',
  listLabel: '当时模型选出的头部球员，最好的在前',
  head: { player: '球员', age: '年龄', rank: '当时排名', tier: '模型级别', later: '此后最佳排名', outcome: '结果' },
  rankNo: (n: number) => `第 ${n} 位`,
  noRanking: '无排名',
  reached: (monthYear: string) => `进入前 100 · ${monthYear}`,
  reachedNoDate: '进入前 100',
  notReached: '未进入前 100',
  hiddenLabel: '点击“看看发生了什么”后显示',
  missedTitle: '模型漏掉了谁',
  missedLabel: '不在模型头部名单中、却进入了前 100 的球员',
  missedLede: (n: number, top: number) =>
    n === 0 ? `模型前 ${top} 名之外，没有球员进入前 100。` : `模型前 ${top} 名之外，还有 ${n} 名球员也进入了前 100。`,
  tierThen: (tier: string) => `当时 ${tier} 级`,
  months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
};
