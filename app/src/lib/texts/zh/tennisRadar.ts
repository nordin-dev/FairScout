import type { Loose } from '../../i18n';
import type * as en from '../en/tennisRadar';

export const tennisRadar: Loose<typeof en.tennisRadar> = {
  kicker: '02 — 雷达',
  title: (n: number, top: number) => `${n} 名年轻球员排在前 ${top} 名之外。`,
  tierLine: (k: number) => (k === 0 ? '没有 A 级球员。' : `其中 ${k} 名是 A 级。`),
  emptyTitle: '没有符合这些筛选条件的球员。',
  lede: (date: string, from: number, to: number, under18: boolean) =>
    `${date} 的 ATP 排名，${under18 ? '18 岁以下' : '21 岁以下'}男子球员，排名 ${from} 至 ${to}。`,
  railLabel: '筛选',
  rankLabel: '排名在以下名次之外',
  rankValue: (n: number) => `> ${n}`,
  country: '国家',
  countries: (n: number, selected: number) => `${n} 个国家${selected < n ? ` · 已选 ${selected} 个` : ''}`,
  countriesList: '国家',
  selectAll: '全选',
  clearAll: '清除',
  age: '年龄',
  under18Only: '仅限未满 18 岁',
  plays: '持拍手',
  leftOnly: '仅限左手持拍',
  headers: { rank: '#', player: '球员', age: '年龄', ranking: '排名', yearAgo: '一年前', record: '胜–负', rating: '评分', outlook: '前景', notes: '备注' },
  tableLabel: '雷达上的年轻网球球员',
  ratingLabel: '评分',
  dash: '—',
  record: (w: number, l: number) => `${w}–${l}`,
  showing: (shown: number, total: number) => (shown >= total ? `共 ${total} 名球员。` : `显示 ${total} 名中的 ${shown} 名。`),
  showAll: '显示全部',
  flags: {
    under18: '未满 18 岁',
    lowSample: '比赛场次少',
    top200: (n: number) => `战胜前 200 名：${n} 场`,
  },
  emptyBlockTitle: '暂时没有合适的球员。',
  emptyText: '降低排名限制或勾选更多国家，就能重新看到球员。',
  reset: '重置筛选',
  loadingNote: '正在加载球员…',
  errorReason: '网球球员名单没有送达。',
  evidenceLine: (hits: number, picked: number, poolRate: number) =>
    `在过往候选池中，模型选出的 ${picked} 名头部球员里有 ${hits} 人进入了前 100；候选池平均为 ${poolRate}%。`,
  evidenceLink: '查看证据 →',
};
