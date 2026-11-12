import type { Loose } from '../../i18n';
import type * as en from '../en/basketTimeMachine';

export const basketTimeMachine: Loose<typeof en.basketTimeMachine> = {
  kicker: '03 — Zaman makinesi',
  seasonsLabel: 'Sezon',
  loadingNote: 'Geçmiş sezonlar yükleniyor…',
  errorReason: 'Basketbol verisi yüklenmedi.',
  emptyTitle: 'Henüz kontrol edilebilecek geçmiş sezon yok.',
  emptyLede: 'Bir sezon, bittikten üç sezon sonra kontrol edilebilir.',
  emptyBlockTitle: 'Veride geçmiş sezon yok.',
  emptyBlockText: 'Modelin geçmiş sezonlardaki testi kanıt ekranında.',
  openEvidence: 'Kanıtı aç →',
  evidencePath: '/evidence',
  thenTitle: (season: string, n: number) => `Zaman: ${season} sezonunun sonu. Modelin en iyi ${n} seçimi bunlar.`,
  thenLede: (pool: number) =>
    `EuroLeague veya EuroCup’ta küçük bir rolü olan 23 yaş altı ${pool} oyuncu. Model yalnızca önceki sezonları görmüştü.`,
  revealedTitle: (hits: number, n: number) => `${n} oyuncudan ${hits} tanesi üç sezon içinde rotasyon oyuncusu oldu.`,
  revealedLede: (pool: number, poolHits: number) => `Havuzdaki tüm ${pool} oyuncudan ${poolHits} tanesi oldu.`,
  reveal: (season: string) => `${season} itibarıyla ne olduğunu göster →`,
  hide: 'Tekrar gizle',
  listLabel: 'O zamanın modelin en iyi oyuncuları, en iyiden başlayarak',
  head: { player: 'Oyuncu', age: 'Yaş', minutes: 'O zamanki maç başına dakika', tier: 'Model seviyesi', later: 'Sonrasındaki en iyi maç başına dakika', outcome: 'Sonuç' },
  minutes: (n: number) => n.toFixed(1),
  noLater: 'yok',
  reached: (season: string) => `Rotasyon oyuncusu oldu · ${season}`,
  reachedNoSeason: 'Rotasyon oyuncusu oldu',
  notReached: (target: number) => `Maç başına ${target} dakikaya ulaşamadı`,
  noLaterSeason: 'EuroLeague veya EuroCup’ta sonraki sezon yok',
  caption: 'NBA’e ya da başka bir lige giden oyuncunun burada sonraki sezonu yoktur ve ulaşamadı sayılır.',
  hiddenLabel: 'ne olduğunu gösterene kadar gizli',
  missedTitle: 'Modelin kaçırdıkları',
  missedLabel: 'Modelin en iyi grubunun dışında olup rotasyon oyuncusu olan oyuncular',
  missedLede: (n: number, top: number) =>
    n === 0
      ? `Modelin en iyi ${top} seçiminin dışındaki hiçbir oyuncu rotasyon oyuncusu olmadı.`
      : `Modelin en iyi ${top} seçiminin dışındaki ${n} oyuncu da rotasyon oyuncusu oldu.`,
  tierThen: (tier: string) => `O zaman ${tier} seviyesi`,
};
