import type { Loose } from '../../i18n';
import type * as en from '../en/tennisRadar';

export const tennisRadar: Loose<typeof en.tennisRadar> = {
  kicker: '02 — Radar',
  title: (n: number, top: number) => `${n} genç oyuncu ilk ${top}’in dışında sıralanıyor.`,
  tierLine: (k: number) => (k === 0 ? 'Hiçbiri A seviyesinde değil.' : `${k} oyuncu A seviyesinde.`),
  emptyTitle: 'Bu filtrelere uyan oyuncu yok.',
  lede: (date: string, from: number, to: number, under18: boolean) =>
    `ATP sıralaması, ${date}; ${under18 ? '18 yaş altı' : '21 yaş altı'} erkekler, ${from}. ile ${to}. sıra arası.`,
  railLabel: 'Filtreler',
  rankLabel: 'İlk kaçın dışında',
  rankValue: (n: number) => `> ${n}`,
  country: 'Ülke',
  countries: (n: number, selected: number) => `${n} ülke${selected < n ? ` · ${selected} seçili` : ''}`,
  countriesList: 'Ülkeler',
  selectAll: 'Tümünü seç',
  clearAll: 'Temizle',
  age: 'Yaş',
  under18Only: 'Yalnızca 18 yaş altı',
  plays: 'Oynadığı el',
  leftOnly: 'Yalnızca solaklar',
  headers: { rank: '#', player: 'Oyuncu', age: 'Yaş', ranking: 'Sıra', yearAgo: 'Bir yıl önce', record: 'G–M', rating: 'Puan', outlook: 'Görünüm', notes: 'Notlar' },
  tableLabel: 'Radardaki genç tenisçiler',
  ratingLabel: 'Puan',
  dash: '—',
  record: (w: number, l: number) => `${w}–${l}`,
  showing: (shown: number, total: number) => (shown >= total ? `${total} oyuncu.` : `${total} oyuncudan ${shown} tanesi gösteriliyor.`),
  showAll: 'Tümünü göster',
  flags: {
    under18: '18 yaş altı',
    lowSample: 'Az maç',
    top200: (n: number) => `İlk 200 galibiyeti: ${n}`,
  },
  emptyBlockTitle: 'Henüz uyan yok.',
  emptyText: 'Oyuncuları yeniden görmek için sıralama sınırını düşür ya da daha fazla ülke işaretle.',
  reset: 'Filtreleri sıfırla',
  loadingNote: 'Oyuncular yükleniyor…',
  errorReason: 'Tenisçi listesi gelmedi.',
  evidenceLine: (hits: number, picked: number, poolRate: number) =>
    `Geçmiş havuzlarda modelin en iyi ${picked} seçiminden ${hits} tanesi ilk 100’e girdi; havuz ortalaması %${poolRate}.`,
  evidenceLink: 'Kanıtı gör →',
};
