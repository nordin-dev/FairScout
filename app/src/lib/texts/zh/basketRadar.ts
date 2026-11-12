import type { Loose } from '../../i18n';
import type * as en from '../en/basketRadar';

export const basketRadar: Loose<typeof en.basketRadar> = {
  kicker: '02 — 雷达',
  title: (n: number, max: number) => `${n} 名年轻球员场均出场不足 ${max} 分钟。`,
  tierLine: (k: number) => (k === 0 ? '没有 A 级球员。' : `其中 ${k} 名是 A 级。`),
  emptyTitle: '没有符合这些筛选条件的球员。',
  lede: (season: string, competitions: string, under20: boolean) =>
    `${season} 赛季，${competitions}，${under20 ? '20 岁以下' : '23 岁以下'}、至少出场五场的球员。`,
  railLabel: '筛选',
  minutesLabel: '场均出场时间低于',
  minutesValue: (n: number) => `< ${n}`,
  position: '位置',
  positions: [
    { value: 'All', label: '全部' },
    { value: 'Guard', label: '后卫' },
    { value: 'Forward', label: '前锋' },
    { value: 'Center', label: '中锋' },
  ] as const,
  competition: '赛事',
  country: '国家',
  countries: (n: number, selected: number) => `${n} 个国家${selected < n ? ` · 已选 ${selected} 个` : ''}`,
  countriesList: '国家',
  selectAll: '全选',
  clearAll: '清除',
  age: '年龄',
  under20Only: '仅限未满 20 岁',
  headers: { rank: '#', player: '球员', pos: '位置', age: '年龄', min: '分钟', pts: '得分', index: '效率值', rating: '评分', outlook: '前景', notes: '备注' },
  tableLabel: '雷达上的年轻篮球球员',
  ratingLabel: '评分',
  dash: '—',
  showing: (shown: number, total: number) => (shown >= total ? `共 ${total} 名球员。` : `显示 ${total} 名中的 ${shown} 名。`),
  showAll: '显示全部',
  flags: { under20: '未满 20 岁', lowSample: '比赛场次少' },
  emptyBlockTitle: '暂时没有合适的球员。',
  emptyText: '提高出场时间上限，或勾选更多赛事和国家，就能重新看到球员。',
  reset: '重置筛选',
  loadingNote: '正在加载球员…',
  errorReason: '篮球球员名单没有送达。',
  evidenceLine: (hits: number, picked: number, poolRate: number) =>
    `在过往候选池中，模型选出的 ${picked} 名头部球员里有 ${hits} 人成为轮换球员；候选池平均为 ${poolRate}%。`,
  evidenceLink: '查看证据 →',
};
