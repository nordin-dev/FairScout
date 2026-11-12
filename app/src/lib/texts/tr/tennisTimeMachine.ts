import type { Loose } from '../../i18n';
import type * as en from '../en/tennisTimeMachine';

export const tennisTimeMachine: Loose<typeof en.tennisTimeMachine> = {
  kicker: '03 — Zaman makinesi',
  yearsLabel: 'Yıl',
  loadingNote: 'Geçmiş yıllar yükleniyor…',
  errorReason: 'Tenis verisi yüklenmedi.',
  emptyTitle: 'Henüz kontrol edilebilecek geçmiş yıl yok.',
  emptyLede: 'Bir yıl, bittikten üç yıl sonra kontrol edilebilir.',
  emptyBlockTitle: 'Veride geçmiş yıl yok.',
  emptyBlockText: 'Modelin geçmiş yıllardaki testi kanıt ekranında.',
  openEvidence: 'Kanıtı aç →',
  evidencePath: '/evidence',
  thenTitle: (monthYear: string, n: number) => `Zaman: ${monthYear}. Modelin en iyi ${n} seçimi bunlar.`,
  thenLede: (date: string, pool: number) =>
    `ATP sıralaması, ${date}: 101. ile 1000. sıra arasındaki 21 yaş altı ${pool} oyuncu. Model yalnızca önceki yılları görmüştü.`,
  revealedTitle: (hits: number, n: number) => `${n} oyuncudan ${hits} tanesi üç yıl içinde ilk 100’e girdi.`,
  revealedLede: (pool: number, poolHits: number) => `Havuzdaki tüm ${pool} oyuncudan ${poolHits} tanesi girdi.`,
  reveal: (monthYear: string) => `${monthYear} itibarıyla ne olduğunu göster →`,
  hide: 'Tekrar gizle',
  listLabel: 'O zamanın modelin en iyi oyuncuları, en iyiden başlayarak',
  head: { player: 'Oyuncu', age: 'Yaş', rank: 'O zamanki sıra', tier: 'Model seviyesi', later: 'Sonrasındaki en iyi sıra', outcome: 'Sonuç' },
  rankNo: (n: number) => `${n}. sıra`,
  noRanking: 'sıralaması yok',
  reached: (monthYear: string) => `İlk 100’e girdi · ${monthYear}`,
  reachedNoDate: 'İlk 100’e girdi',
  notReached: 'İlk 100’e giremedi',
  hiddenLabel: 'ne olduğunu gösterene kadar gizli',
  missedTitle: 'Modelin kaçırdıkları',
  missedLabel: 'Modelin en iyi grubunun dışında olup ilk 100’e giren oyuncular',
  missedLede: (n: number, top: number) =>
    n === 0
      ? `Modelin en iyi ${top} seçiminin dışındaki hiçbir oyuncu ilk 100’e girmedi.`
      : `Modelin en iyi ${top} seçiminin dışındaki ${n} oyuncu da ilk 100’e girdi.`,
  tierThen: (tier: string) => `O zaman ${tier} seviyesi`,
  months: [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
  ],
};
