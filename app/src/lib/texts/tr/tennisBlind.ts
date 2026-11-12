import type { Loose } from '../../i18n';
import type * as en from '../en/tennisBlind';

export const tennisBlind: Loose<typeof en.tennisBlind> = {
  kicker: '01 — Kör seçim',
  question: 'Ne arıyorsun?',
  ageLabel: 'Yaş',
  ages: [
    { value: '19', label: '19 ve altı' },
    { value: '20', label: '21 yaş altı' },
  ],
  hiddenLabel: 'Ne kadar gizli',
  hiddens: [
    { value: '150', label: 'İlk 150’nin dışında' },
    { value: '250', label: 'İlk 250’nin dışında' },
    { value: '400', label: 'İlk 400’ün dışında' },
  ],
  mattersLabel: 'En önemlisi',
  mattersHint: 'iki tane seç',
  matters: [
    { value: 'wins', label: 'Maç kazanır' },
    { value: 'level', label: 'Yüksek seviyede oynar' },
    { value: 'rise', label: 'Hızla yükselir' },
  ],
  countPlural: 'oyuncu uyuyor',
  tooFew: (n: number) => `${n} oyuncu uyuyor. 3 oyuncu gerekli: yaşı veya sıralamayı gevşet.`,
  loadingPlayers: 'Oyuncular yükleniyor…',
  showThree: 'Bana üç oyuncu göster, isimsiz →',
  title: 'Üç oyuncu. İsim yok. Birini seç.',
  ageWords: (maxAge: number) => (maxAge === 20 ? '21 yaş altı' : `${maxAge} ve altı`),
  summary: (ageWords: string, hidden: number, matters: string[]) =>
    [ageWords, `ilk ${hidden}’in dışında`, ...matters].join(' · '),
  matterWords: { wins: 'maç kazanır', level: 'yüksek seviyede oynar', rise: 'hızla yükselir' },
  change: 'Değiştir',
  dimLabels: { wins: 'Kazanma', level: 'Oyun seviyesi', rise: 'Yükseliş' },
  caption:
    'Görünüm = modelin, oyuncunun üç yıl içinde ilk 100’e girme tahmini. 100 üzerinden puanlar; havuzdaki diğer oyuncularla kıyaslanır.',
  candidate: (letter: string) => `Oyuncu ${letter}`,
  facts: (age: number, hand: 'Right' | 'Left' | null) =>
    `${age} yaşında${hand === null ? '' : hand === 'Right' ? ' · sağ elini kullanıyor' : ' · sol elini kullanıyor'}`,
  pick: 'Bu oyuncuyu seç',
  pickLabel: (letter: string) => `${letter} oyuncusunu seç`,
  labelRanking: 'Sıralama',
  labelRecord: 'Galibiyet–mağlubiyet',
  labelOutlook: 'Görünüm',
  ranking: (rank: number) => `${rank}. sıra`,
  record: (wins: number, losses: number) => `${wins}–${losses}`,
  yourPick: 'Senin seçimin',
  tagModel: 'Modelin seçimi',
  tagRanking: 'En iyi sıralama',
  verdictAgree: (letter: string) => `Sen ve model aynı fikirdesiniz: ${letter}.`,
  verdictAgreeSub: 'Kim olduğuna göre değil, ne yaptığına göre seçildi. Listende.',
  verdictDisagree: (you: string, model: string) => `Sen ${you} oyuncusunu seçtin. Model ${model} oyuncusunu seçti.`,
  verdictDisagreeSub: 'İkisi de listene giriyor. Fikir ayrılığı olan yer bir geziyi hak eder.',
  seeWhy: 'Nedenini gör →',
  reasonLabel: (model: string, scout: string) => `${model} ve ${scout} yan yana`,
  reasonCandidate: (letter: string, name: string) => `${letter} · ${name}`,
  reasonRows: {
    tier: 'Görünüm',
    rank: 'Sıralama',
    winRate: 'Galibiyet oranı, %',
    age: 'Yaş',
    top200: 'İlk 200’deki oyunculara karşı galibiyetler',
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
    rank: 'daha iyi sıralama',
    winRate: 'daha yüksek galibiyet oranı',
    age: 'daha genç yaş',
    top200: 'ilk 200’dekilere karşı daha fazla galibiyet',
  },
  reasonBehind: {
    rank: 'daha kötü sıralama',
    winRate: 'daha düşük galibiyet oranı',
    age: 'daha büyük yaş',
    top200: 'ilk 200’dekilere karşı daha az galibiyet',
  },
  reasonRowsAhead: (model: string, ahead: string, behind: string) =>
    ahead && behind ? `${model}: ${ahead}, ancak ${behind}.` : ahead ? `${model}: ${ahead}.` : behind ? `${model}: ${behind}.` : '',
  reasonList: (items: string[]) =>
    items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`,
  errorFile: 'tennis.json',
};
