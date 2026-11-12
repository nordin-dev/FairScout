import type { Loose } from '../../i18n';
import type * as en from '../en/basketRadar';

export const basketRadar: Loose<typeof en.basketRadar> = {
  kicker: '02 — Radar',
  title: (n: number, max: number) => `${n} genç oyuncunun maç başına ortalaması ${max} dakikanın altında.`,
  tierLine: (k: number) => (k === 0 ? 'Hiçbiri A seviyesinde değil.' : `${k} oyuncu A seviyesinde.`),
  emptyTitle: 'Bu filtrelere uyan oyuncu yok.',
  lede: (season: string, competitions: string, under20: boolean) =>
    `${season} sezonu, ${competitions}, en az beş maç oynamış ${under20 ? '20 yaş altı' : '23 yaş altı'} oyuncular.`,
  railLabel: 'Filtreler',
  minutesLabel: 'Maç başına dakika şundan az',
  minutesValue: (n: number) => `< ${n}`,
  position: 'Mevki',
  positions: [
    { value: 'All', label: 'Tümü' },
    { value: 'Guard', label: 'Guard' },
    { value: 'Forward', label: 'Forvet' },
    { value: 'Center', label: 'Pivot' },
  ] as const,
  competition: 'Turnuva',
  country: 'Ülke',
  countries: (n: number, selected: number) => `${n} ülke${selected < n ? ` · ${selected} seçili` : ''}`,
  countriesList: 'Ülkeler',
  selectAll: 'Tümünü seç',
  clearAll: 'Temizle',
  age: 'Yaş',
  under20Only: 'Yalnızca 20 yaş altı',
  headers: { rank: '#', player: 'Oyuncu', pos: 'Mevki', age: 'Yaş', min: 'Dk', pts: 'Sayı', index: 'Verimlilik', rating: 'Puan', outlook: 'Görünüm', notes: 'Notlar' },
  tableLabel: 'Radardaki genç basketbolcular',
  ratingLabel: 'Puan',
  dash: '—',
  showing: (shown: number, total: number) => (shown >= total ? `${total} oyuncu.` : `${total} oyuncudan ${shown} tanesi gösteriliyor.`),
  showAll: 'Tümünü göster',
  flags: { under20: '20 yaş altı', lowSample: 'Az maç' },
  emptyBlockTitle: 'Henüz uyan yok.',
  emptyText: 'Oyuncuları yeniden görmek için dakika sınırını yükselt ya da daha fazla turnuva ve ülke işaretle.',
  reset: 'Filtreleri sıfırla',
  loadingNote: 'Oyuncular yükleniyor…',
  errorReason: 'Basketbolcu listesi gelmedi.',
  evidenceLine: (hits: number, picked: number, poolRate: number) =>
    `Geçmiş havuzlarda modelin en iyi ${picked} seçiminden ${hits} tanesi rotasyon oyuncusu oldu; havuz ortalaması %${poolRate}.`,
  evidenceLink: 'Kanıtı gör →',
};
