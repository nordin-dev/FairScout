import type { Loose } from '../../i18n';
import type * as en from '../en/tennisEvidence';
import type { Evidence } from '../../tennis/evidence';

const range = (e: Evidence): string => (e.years ? `${e.years[0]} – ${e.years[1]}` : 'geçmiş yıllar');

export const tennisEvidence: Loose<typeof en.tennisEvidence> = {
  kicker: '04 — Kanıt',
  title: (e: Evidence) => `Modelin en iyi ${e.picked} seçiminden ${e.modelHits} tanesi ilk 100’e girdi. Havuz ortalaması %${e.poolRatePct}.`,
  lede: (e: Evidence) => `${e.byYear.length || 'Geçmiş'} havuz, ${range(e)}. Her biri yalnızca önceki yılları görmüş bir modelle puanlandı.`,
  heroFirst: (e: Evidence) => `Modelin ilk %10’u: ${e.picked} oyuncudan ${e.modelHits}`,
  heroSecond: (e: Evidence) => `Tüm havuz: ${e.pool} oyuncudan ${e.poolHits}`,
  rulesTitle: 'Basit kurallara karşı',
  rulesSub: 'Üç yıl içinde ilk 100’e giren oyuncular, seçim yöntemine göre.',
  chartTitle: 'İlk 100’e giren oyuncular, seçim yöntemine göre',
  poolLine: (rate: number) => `Tüm oyuncular: %${rate}`,
  printed: (hits: number, picked: number, percent: number) => `${picked} oyuncudan ${hits} · %${percent}`,
  tip: (label: string, hits: number, picked: number) => `${label}: seçtiği ${picked} oyuncudan ${hits} tanesi üç yıl içinde ilk 100’e girdi.`,
  honest: (e: Evidence): string => {
    if (!e.rival) return '';
    const first = `Yalnızca “${e.rival.label}” ölçütüyle seçmek ${e.picked} oyuncudan ${e.rival.hits} verir.`;
    if (e.verdict === 'inside') return `${first} Modelin buna karşı farkı ±${e.marginPct} yüzde puanlık hata payının içinde: bu kuralı geçtiğini iddia edemeyiz.`;
    if (e.verdict === 'ahead') return `${first} Modelin buna karşı farkı, ${e.leadPct} yüzde puanı, ±${e.marginPct} yüzde puanlık hata payından büyük.`;
    return `${first} Model bu kuralın önünde değil.`;
  },
  tiersTitle: 'Bir seviye ne anlama geldi',
  tierLabel: (tier: string) => `${tier} seviyesi`,
  tierCaption: (hits: number, n: number, percent: number) => `${n} oyuncudan ${hits} tanesi ilk 100’e girdi (%${percent})`,
  yearsTitle: 'Yıl yıl',
  yearsLabel: 'Her test yılı: havuz ve iki kuralın ilk %10’u',
  headers: { year: 'Yıl', pool: 'Havuz', reached: 'İlk 100’e girdi', model: 'Modelin ilk %10’u', rank: 'En iyi sıralamanın ilk %10’u' },
  ofCount: (hits: number, n: number) => `${n} oyuncudan ${hits}`,
  tally: (t: { ahead: number; level: number; behind: number; years: number }) =>
    `Modelin ilk %10’u, ${t.years} yılın ${t.ahead} tanesinde en iyi sıralamanınkinin önünde, ${t.level} tanesinde eşit, ${t.behind} tanesinde geride kaldı.`,
  methodTitle: 'Nasıl test edildi',
  method: (e: Evidence, trainedOn: number, poolRule: string, outcome: string) => [
    `Havuz: ${poolRule}.`,
    `Sonuç: ${outcome}. Bu, sıralamadaki bir yerdir, piyasa değeri değil.`,
    `Model bir lojistik regresyondur ve geçmiş havuzlardaki ${trainedOn} oyuncuya göre kuruldu.`,
    'Test ileriye doğru yürür. Her yılın havuzu, yalnızca üç yılı çoktan bitmiş havuzlara göre kurulan bir modelle puanlandı.',
    `Seçimler, her yılın havuzunun ilk %10’udur; toplam ${e.picked} oyuncu. Diğer kurallar aynı sayıda oyuncu seçer.`,
  ],
  inputsTitle: 'Model neye bakıyor',
  inputLine: (words: string) => `${words}: daha yüksek puan`,
  /** Name of each input, then the words that raise the score when its weight is positive, and when it is negative. */
  inputs: {
    age: ['Yaş', 'daha büyük yaş', 'daha genç yaş'],
    log_rank: ['Sıralama', 'daha kötü sıralama', 'daha iyi sıralama'],
    win_pct: ['Galibiyet oranı', 'daha yüksek galibiyet oranı', 'daha düşük galibiyet oranı'],
    upper_share: ['Seviye', 'Challenger ve üzeri seviyede daha fazla maç', 'Challenger ve üzeri seviyede daha az maç'],
    log_top200_wins: ['İlk 200 galibiyetleri', 'ilk 200’dekilere karşı daha fazla galibiyet', 'ilk 200’dekilere karşı daha az galibiyet'],
  } as Record<string, [string, string, string]>,
  limitsTitle: 'Sınırlar',
  limits: (date: string) => [
    'Havuzlar küçük, yılda yaklaşık yüz oyuncu. Tek bir yıl tabloyu değiştirebilir.',
    'Sonuç, sıralamadaki bir yerdir, piyasa değeri değil.',
    `Veri ${date} tarihinde bitiyor.`,
    'Yalnızca erkekler turu.',
    'Yalnızca en iyi sıralamaya göre seçmek neredeyse bu kadar iyi.',
  ],
  loadingNote: 'Test yükleniyor…',
  errorReason: 'Tenis testi gelmedi.',
};
