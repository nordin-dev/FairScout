import { seasonOf, type Evidence } from '../../basketball/evidence';
import type { Loose } from '../../i18n';
import type * as en from '../en/basketEvidence';

const RULES: Record<string, string> = {
  Youngest: '最年轻',
  'Most minutes': '出场时间最多',
  'Best index rating per game': '场均效率值最高',
  'Best ranking': '排名最高',
  'Most wins': '胜场最多',
};

const range = (e: Evidence): string => (e.years ? `${seasonOf(e.years[0])} 至 ${seasonOf(e.years[1])} 赛季` : '过往赛季');

export const basketEvidence: Loose<typeof en.basketEvidence> = {
  kicker: '04 — 证据',
  title: (e: Evidence) => `模型选出的 ${e.picked} 名头部球员中，有 ${e.modelHits} 人成为轮换球员。候选池平均为 ${e.poolRatePct}%。`,
  lede: (e: Evidence) => `${e.byYear.length || '过往'} 个往期候选池，${range(e)}。每个都由只见过更早赛季的模型打分。`,
  heroFirst: (e: Evidence) => `模型的前 10%：${e.picked} 人中 ${e.modelHits} 人`,
  heroSecond: (e: Evidence) => `整个候选池：${e.pool} 人中 ${e.poolHits} 人`,
  rulesTitle: '与简单规则对比',
  chartTitle: '各种选人方式中，成为轮换球员的球员',
  poolLine: (rate: number) => `全部球员：${rate}%`,
  printed: (hits: number, picked: number, percent: number) => `${picked} 人中 ${hits} 人 · ${percent}%`,
  tip: (label: string, hits: number, picked: number) => `${label}：选出的 ${picked} 名球员中，有 ${hits} 人在三个赛季内成为轮换球员。`,
  honest: (e: Evidence): string => {
    if (!e.rival) return '';
    const first = `只按“${RULES[e.rival.label] ?? e.rival.label}”来选，${e.picked} 人中有 ${e.rival.hits} 人。`;
    if (e.verdict === 'inside') return `${first}模型对它的领先在 ±${e.marginPct} 个百分点的误差范围之内：我们不能说模型胜过这条规则。`;
    if (e.verdict === 'ahead') return `${first}模型对它的领先为 ${e.leadPct} 个百分点，大于 ±${e.marginPct} 个百分点的误差范围。`;
    return `${first}模型并不领先于它。`;
  },
  tiersTitle: '各级别的含义',
  tierLabel: (tier: string) => `${tier} 级`,
  tierCaption: (hits: number, n: number, percent: number) => `${n} 人中 ${hits} 人成为轮换球员（${percent}%）`,
  yearsTitle: '逐个赛季',
  yearsLabel: '每个检验赛季：候选池，以及两种规则的前 10%',
  headers: { year: '赛季', pool: '候选池', reached: '成为轮换球员', model: '模型的前 10%', rank: '出场时间最多者的前 10%' },
  ofCount: (hits: number, n: number) => `${n} 人中 ${hits} 人`,
  tally: (t: { ahead: number; level: number; behind: number; years: number }) =>
    `在 ${t.years} 个赛季中，模型的前 10% 有 ${t.ahead} 个赛季领先于“出场时间最多”规则的前 10%，${t.level} 个赛季持平，${t.behind} 个赛季落后。`,
  methodTitle: '如何检验',
  method: (e: Evidence, trainedOn: number, poolRule: string, outcome: string) => [
    `候选池：${poolRule}`,
    `结果：${outcome}这指的是出场时间，而不是收入。`,
    `模型是逻辑回归，用过往候选池中的 ${trainedOn} 名球员拟合。`,
    '检验按时间向前推进。每个赛季的候选池，都由只用此后三个赛季已经结束的候选池拟合的模型打分。',
    `入选者是每个赛季候选池的前 10%，共 ${e.picked} 名球员。其他规则选出同样的人数。`,
  ],
  inputsTitle: '模型看什么',
  inputLine: (words: string) => `${words}：分数更高`,
  /** 每个输入项的名称，然后是权重为正、为负时抬高分数的说法。 */
  inputs: {
    age: ['年龄', '年龄更大', '年龄更小'],
    mpg: ['场均出场时间', '场均出场时间更多', '场均出场时间更少'],
    pir40: ['每 40 分钟效率值', '每 40 分钟效率值更高', '每 40 分钟效率值更低'],
    pts40: ['每 40 分钟得分', '每 40 分钟得分更多', '每 40 分钟得分更少'],
    games: ['场次', '出场场次更多', '出场场次更少'],
    euroleague: ['赛事', '效力于 EuroLeague 而不是 EuroCup', '效力于 EuroCup 而不是 EuroLeague'],
  } as Record<string, [string, string, string]>,
  limitsTitle: '局限',
  limits: [
    '候选池很小，每个赛季只有几十名球员。某一个赛季就可能改变整体结论。',
    '结果指的是出场时间，而不是收入。',
    '转投 NBA 或这两项赛事之外的联赛，按“未达到”计算。',
    '只覆盖欧洲篮球联赛（EuroLeague）和 EuroCup，所以各国国内联赛中更年轻的天才不在数据里。',
  ],
  loadingNote: '正在加载检验结果…',
  errorReason: '篮球检验结果没有送达。',
};
