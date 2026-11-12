import type { Evidence } from '../../tennis/evidence';
import type { Loose } from '../../i18n';
import type * as en from '../en/tennisEvidence';

const RULES: Record<string, string> = {
  Youngest: '最年轻',
  'Best index rating per game': '场均效率值最高',
  'Best ranking': '排名最高',
  'Most wins': '胜场最多',
};

const range = (e: Evidence): string => (e.years ? `${e.years[0]} 至 ${e.years[1]}` : '过往年份');

export const tennisEvidence: Loose<typeof en.tennisEvidence> = {
  kicker: '04 — 证据',
  title: (e: Evidence) => `模型选出的 ${e.picked} 名头部球员中，有 ${e.modelHits} 人进入了前 100。候选池平均为 ${e.poolRatePct}%。`,
  lede: (e: Evidence) => `${e.byYear.length || '过往'} 个候选池，${range(e)}。每个都由只见过更早年份的模型打分。`,
  heroFirst: (e: Evidence) => `模型的前 10%：${e.picked} 人中 ${e.modelHits} 人`,
  heroSecond: (e: Evidence) => `整个候选池：${e.pool} 人中 ${e.poolHits} 人`,
  rulesTitle: '与简单规则对比',
  rulesSub: '各种选人方式中，三年内进入前 100 的球员。',
  chartTitle: '各种选人方式中，进入前 100 的球员',
  poolLine: (rate: number) => `全部球员：${rate}%`,
  printed: (hits: number, picked: number, percent: number) => `${picked} 人中 ${hits} 人 · ${percent}%`,
  tip: (label: string, hits: number, picked: number) => `${label}：选出的 ${picked} 名球员中，有 ${hits} 人在三年内进入前 100。`,
  honest: (e: Evidence): string => {
    if (!e.rival) return '';
    const first = `只按“${RULES[e.rival.label] ?? e.rival.label}”来选，${e.picked} 人中有 ${e.rival.hits} 人。`;
    if (e.verdict === 'inside') return `${first}模型对它的领先在 ±${e.marginPct} 个百分点的误差范围之内：我们不能说模型胜过这条规则。`;
    if (e.verdict === 'ahead') return `${first}模型对它的领先为 ${e.leadPct} 个百分点，大于 ±${e.marginPct} 个百分点的误差范围。`;
    return `${first}模型并不领先于它。`;
  },
  tiersTitle: '各级别的含义',
  tierLabel: (tier: string) => `${tier} 级`,
  tierCaption: (hits: number, n: number, percent: number) => `${n} 人中 ${hits} 人进入前 100（${percent}%）`,
  yearsTitle: '逐年情况',
  yearsLabel: '每个检验年份：候选池，以及两种规则的前 10%',
  headers: { year: '年份', pool: '候选池', reached: '进入前 100', model: '模型的前 10%', rank: '排名最高者的前 10%' },
  ofCount: (hits: number, n: number) => `${n} 人中 ${hits} 人`,
  tally: (t: { ahead: number; level: number; behind: number; years: number }) =>
    `在 ${t.years} 年中，模型的前 10% 有 ${t.ahead} 年领先于排名最高者的前 10%，${t.level} 年持平，${t.behind} 年落后。`,
  methodTitle: '如何检验',
  method: (e: Evidence, trainedOn: number, poolRule: string, outcome: string) => [
    `候选池：${poolRule}。`,
    `结果：${outcome}。这指的是排名中的名次，而不是身价。`,
    `模型是逻辑回归，用过往候选池中的 ${trainedOn} 名球员拟合。`,
    '检验按时间向前推进。每年的候选池，都由只用三年期已经结束的候选池拟合的模型打分。',
    `入选者是每年候选池的前 10%，共 ${e.picked} 名球员。其他规则选出同样的人数。`,
  ],
  inputsTitle: '模型看什么',
  inputLine: (words: string) => `${words}：分数更高`,
  /** 每个输入项的名称，然后是权重为正、为负时抬高分数的说法。 */
  inputs: {
    age: ['年龄', '年龄更大', '年龄更小'],
    log_rank: ['排名', '排名更低', '排名更高'],
    win_pct: ['胜率', '胜率更高', '胜率更低'],
    upper_share: ['水平', '在挑战赛（Challenger）及以上级别的比赛更多', '在挑战赛（Challenger）及以上级别的比赛更少'],
    log_top200_wins: ['战胜前 200 名', '战胜前 200 名球员的场次更多', '战胜前 200 名球员的场次更少'],
  } as Record<string, [string, string, string]>,
  limitsTitle: '局限',
  limits: (date: string) => [
    '候选池很小，每年大约一百名球员。某一年就可能改变整体结论。',
    '结果指的是排名中的名次，而不是身价。',
    `数据截止到 ${date}。`,
    '仅限男子巡回赛。',
    '只按排名最高来选，效果几乎一样好。',
  ],
  loadingNote: '正在加载检验结果…',
  errorReason: '网球检验结果没有送达。',
};
