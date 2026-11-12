import type { Loose } from '../../i18n';
import type * as en from '../en/basketEvidence';
import { seasonOf, type Evidence } from '../../basketball/evidence';

const range = (e: Evidence): string => (e.years ? `${seasonOf(e.years[0])} – ${seasonOf(e.years[1])} sezonları` : 'geçmiş sezonlar');

export const basketEvidence: Loose<typeof en.basketEvidence> = {
  kicker: '04 — Kanıt',
  title: (e: Evidence) => `Modelin en iyi ${e.picked} seçiminden ${e.modelHits} tanesi rotasyon oyuncusu oldu. Havuz ortalaması %${e.poolRatePct}.`,
  lede: (e: Evidence) => `${e.byYear.length || 'Geçmiş'} geçmiş havuz, ${range(e)}. Her biri yalnızca önceki sezonları görmüş bir modelle puanlandı.`,
  heroFirst: (e: Evidence) => `Modelin ilk %10’u: ${e.picked} oyuncudan ${e.modelHits}`,
  heroSecond: (e: Evidence) => `Tüm havuz: ${e.pool} oyuncudan ${e.poolHits}`,
  rulesTitle: 'Basit kurallara karşı',
  chartTitle: 'Rotasyon oyuncusu olan oyuncular, seçim yöntemine göre',
  poolLine: (rate: number) => `Tüm oyuncular: %${rate}`,
  printed: (hits: number, picked: number, percent: number) => `${picked} oyuncudan ${hits} · %${percent}`,
  tip: (label: string, hits: number, picked: number) => `${label}: seçtiği ${picked} oyuncudan ${hits} tanesi üç sezon içinde rotasyon oyuncusu oldu.`,
  honest: (e: Evidence): string => {
    if (!e.rival) return '';
    const first = `Yalnızca “${e.rival.label}” ölçütüyle seçmek ${e.picked} oyuncudan ${e.rival.hits} verir.`;
    if (e.verdict === 'inside') return `${first} Modelin buna karşı farkı ±${e.marginPct} yüzde puanlık hata payının içinde: bu kuralı geçtiğini iddia edemeyiz.`;
    if (e.verdict === 'ahead') return `${first} Modelin buna karşı farkı, ${e.leadPct} yüzde puanı, ±${e.marginPct} yüzde puanlık hata payından büyük.`;
    return `${first} Model bu kuralın önünde değil.`;
  },
  tiersTitle: 'Bir seviye ne anlama geldi',
  tierLabel: (tier: string) => `${tier} seviyesi`,
  tierCaption: (hits: number, n: number, percent: number) => `${n} oyuncudan ${hits} tanesi rotasyon oyuncusu oldu (%${percent})`,
  yearsTitle: 'Sezon sezon',
  yearsLabel: 'Test edilen her sezon: havuz ve iki kuralın ilk %10’u',
  headers: { year: 'Sezon', pool: 'Havuz', reached: 'Rotasyon oyuncusu oldu', model: 'Modelin ilk %10’u', rank: 'En çok dakikanın ilk %10’u' },
  ofCount: (hits: number, n: number) => `${n} oyuncudan ${hits}`,
  tally: (t: { ahead: number; level: number; behind: number; years: number }) =>
    `Modelin ilk %10’u, ${t.years} sezonun ${t.ahead} tanesinde “en çok dakika” kuralınınkinin önünde, ${t.level} tanesinde eşit, ${t.behind} tanesinde geride kaldı.`,
  methodTitle: 'Nasıl test edildi',
  method: (e: Evidence, trainedOn: number, poolRule: string, outcome: string) => [
    `Havuz: ${poolRule}`,
    `Sonuç: ${outcome} Bu, oynama süresidir, para değil.`,
    `Model bir lojistik regresyondur ve geçmiş havuzlardaki ${trainedOn} oyuncuya göre kuruldu.`,
    'Test ileriye doğru yürür. Her sezonun havuzu, yalnızca takip eden üç sezonu çoktan bitmiş havuzlara göre kurulan bir modelle puanlandı.',
    `Seçimler, her sezonun havuzunun ilk %10’udur; toplam ${e.picked} oyuncu. Diğer kurallar aynı sayıda oyuncu seçer.`,
  ],
  inputsTitle: 'Model neye bakıyor',
  inputLine: (words: string) => `${words}: daha yüksek puan`,
  /** Name of each input, then the words that raise the score when its weight is positive, and when it is negative. */
  inputs: {
    age: ['Yaş', 'daha büyük yaş', 'daha genç yaş'],
    mpg: ['Maç başına dakika', 'maç başına daha fazla dakika', 'maç başına daha az dakika'],
    pir40: ['40 dakika başına verimlilik puanı', '40 dakika başına daha yüksek verimlilik puanı', '40 dakika başına daha düşük verimlilik puanı'],
    pts40: ['40 dakika başına sayı', '40 dakika başına daha fazla sayı', '40 dakika başına daha az sayı'],
    games: ['Maç', 'daha fazla oynanan maç', 'daha az oynanan maç'],
    euroleague: ['Turnuva', 'EuroCup yerine EuroLeague’de oynamak', 'EuroLeague yerine EuroCup’ta oynamak'],
  } as Record<string, [string, string, string]>,
  limitsTitle: 'Sınırlar',
  limits: [
    'Havuzlar küçük, sezonda birkaç düzine oyuncu. Tek bir sezon tabloyu değiştirebilir.',
    'Sonuç, oynama süresidir, para değil.',
    'NBA’e ya da bu iki turnuvanın dışındaki bir lige geçiş, ulaşamadı olarak sayılır.',
    'Yalnızca EuroLeague ve EuroCup kapsanıyor; bu yüzden ulusal liglerdeki daha genç yetenekler veride yok.',
  ],
  loadingNote: 'Test yükleniyor…',
  errorReason: 'Basketbol testi gelmedi.',
};
