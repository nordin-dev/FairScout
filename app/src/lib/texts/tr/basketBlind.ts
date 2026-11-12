import type { Loose } from '../../i18n';
import type * as en from '../en/basketBlind';

export const basketBlind: Loose<typeof en.basketBlind> = {
  kicker: '01 — Kör seçim',
  question: 'Ne arıyorsun?',
  positionLabel: 'Mevki',
  positions: [
    { value: 'Any', label: 'Fark etmez' },
    { value: 'Guard', label: 'Guard' },
    { value: 'Forward', label: 'Forvet' },
    { value: 'Center', label: 'Pivot' },
  ],
  ageLabel: 'Yaş',
  ages: [
    { value: '21', label: '21 yaş altı' },
    { value: '23', label: '23 yaş altı' },
  ],
  hiddenLabel: 'Ne kadar gizli',
  hiddens: [
    { value: '18', label: 'Maçta 18 dakikanın altı' },
    { value: '12', label: 'Maçta 12 dakikanın altı' },
    { value: '8', label: 'Maçta 8 dakikanın altı' },
  ],
  mattersLabel: 'En önemlisi',
  mattersHint: 'iki tane seç',
  matters: [
    { value: 'scoring', label: 'Sayı atar' },
    { value: 'impact', label: 'Genel etki' },
    { value: 'trust', label: 'Koçun güveni' },
  ],
  countPlural: 'oyuncu uyuyor',
  tooFew: (n: number) => `${n} oyuncu uyuyor. 3 oyuncu gerekli: mevkiyi, yaşı veya dakikayı gevşet.`,
  loadingPlayers: 'Oyuncular yükleniyor…',
  showThree: 'Bana üç oyuncu göster, isimsiz →',
  title: 'Üç oyuncu. İsim yok. Birini seç.',
  summary: (position: string, age: string, hidden: number, matters: string[]) =>
    [position === 'Any' ? 'Mevki fark etmez' : position, age, `maçta ${hidden} dakikanın altı`, ...matters].join(' · '),
  matterWords: { scoring: 'sayı atar', impact: 'genel etki', trust: 'koçun güveni' },
  change: 'Değiştir',
  dimLabels: { scoring: 'Sayı', impact: 'Genel etki', trust: 'Koçun güveni' },
  caption: (minutes: number) =>
    `Görünüm = modelin, oyuncunun üç sezon içinde rotasyon oyuncusu (maçta ${minutes} dakika) olma tahmini. 100 üzerinden puanlar; havuzdaki diğer oyuncularla kıyaslanır.`,
  candidate: (letter: string) => `Oyuncu ${letter}`,
  facts: (position: string | null, age: number, height: number | null) =>
    [position, `${age} yaşında`, height === null ? null : `${height} cm`].filter(Boolean).join(' · '),
  pick: 'Bu oyuncuyu seç',
  pickLabel: (letter: string) => `${letter} oyuncusunu seç`,
  labelMinutes: 'Dakika',
  labelPoints: 'Sayı',
  labelOutlook: 'Görünüm',
  perGame: (n: number) => `maçta ${n.toFixed(1)}`,
  yourPick: 'Senin seçimin',
  tagModel: 'Modelin seçimi',
  tagMinutes: 'En çok dakika',
  verdictAgree: (letter: string) => `Sen ve model aynı fikirdesiniz: ${letter}.`,
  verdictAgreeSub: 'Kim olduğuna göre değil, ne yaptığına göre seçildi. Listende.',
  verdictDisagree: (you: string, model: string) => `Sen ${you} oyuncusunu seçtin. Model ${model} oyuncusunu seçti.`,
  verdictDisagreeSub: 'İkisi de listene giriyor. Fikir ayrılığı olan yer bir geziyi hak eder.',
  seeWhy: 'Nedenini gör →',
  reasonLabel: (model: string, scout: string) => `${model} ve ${scout} yan yana`,
  reasonCandidate: (letter: string, name: string) => `${letter} · ${name}`,
  reasonRows: {
    tier: 'Görünüm',
    mpg: 'Maç başına dakika',
    ppg: 'Maç başına sayı',
    pir40: '40 dakika başına verimlilik puanı',
    age: 'Yaş',
  },
  noValue: '—',
  reasonAheadMark: '✓',
  reasonAheadWord: 'önde',
  reasonAheadNote: '✓ = bu satırda önde',
  reasonTiers: (model: string, modelTier: string, scout: string, scoutTier: string) =>
    modelTier === scoutTier
      ? `${model} ve ${scout}: ikisinin de görünümü ${modelTier} seviyesinde.`
      : `${model}: görünüm ${modelTier} seviyesi, ${scout}: görünüm ${scoutTier} seviyesi.`,
  reasonTiersBetter: (model: string, modelTier: string, scout: string, scoutTier: string) =>
    `Model görünümü nedeniyle şu oyuncuyu tercih ediyor: ${model}. ${modelTier} seviyesi, ${scout} için ise ${scoutTier} seviyesi.`,
  reasonScoreHigher: (model: string) => `Bu seviye içinde model, ${model} için daha yüksek puan veriyor.`,
  reasonDrivers: (model: string, items: string[]) => `Modelin ${model} için gördükleri: ${items.join(' · ')}.`,
  reasonAhead: {
    mpg: 'daha fazla dakika',
    ppg: 'daha fazla sayı',
    pir40: 'daha yüksek verimlilik puanı',
    age: 'daha genç yaş',
  },
  reasonBehind: {
    mpg: 'daha az dakika',
    ppg: 'daha az sayı',
    pir40: 'daha düşük verimlilik puanı',
    age: 'daha büyük yaş',
  },
  reasonRowsAhead: (model: string, ahead: string, behind: string) =>
    ahead && behind ? `${model}: ${ahead}, ancak ${behind}.` : ahead ? `${model}: ${ahead}.` : behind ? `${model}: ${behind}.` : '',
  reasonList: (items: string[]) =>
    items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`,
  errorFile: 'basketball.json',
};
