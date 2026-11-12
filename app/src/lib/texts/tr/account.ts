import type { Loose } from '../../i18n';
import type * as en from '../en/account';
import type { AccountError, PickSource, PickSport } from '../../account';

export const account: Loose<typeof en.account> = {
  kicker: 'Hesap',
  title: 'Gözlemci hesabın',
  switchLabel: 'Giriş yap ya da hesap oluştur',
  modeLogin: 'Giriş yap',
  modeRegister: 'Hesap oluştur',
  nameLabel: 'Ad',
  passwordLabel: 'Parola',
  submitLogin: 'Giriş yap',
  submitRegister: 'Hesap oluştur',
  errors: {
    name: 'En az 2 karakterlik bir ad kullan.',
    password: 'En az 4 karakterlik bir parola kullan.',
    taken: 'Bu ad bu bilgisayarda zaten kullanılıyor. Bunun yerine giriş yap.',
    wrong: 'Ad ya da parola uyuşmuyor.',
  } satisfies Record<AccountError, string>,
  caption: 'Hesaplar yalnızca bu tarayıcıda tutulur. Sunucu yok; bu yüzden burada açılan hesap başka bir bilgisayarda bulunmaz.',
  signedIn: (name: string) => `Giriş yapan: ${name}`,
  toPicks: 'Seçimlerime git',
  logout: 'Çıkış yap',
  header: {
    login: 'Giriş yap',
    picks: 'Seçimlerim',
    loginTip: 'Giriş yap ya da hesap oluştur',
  },
};

export const myPicks: Loose<typeof en.myPicks> = {
  kicker: 'Seçimlerim',
  signedOutTitle: 'Seçimlerini saklamak için giriş yap.',
  signedOutText: 'Listen, giriş yapan gözlemci için saklanır.',
  signedOutAction: 'Giriş yap',
  title: (n: number) => (n === 0 ? 'Listen boş.' : `Listende ${n} oyuncu var.`),
  emptyText: 'Benzerlerden, radardan ya da bir oyuncu kartından oyuncu ekle.',
  lede: (name: string) => `Gözlemci: ${name}`,
  filterLabel: 'Sporu göster',
  all: 'Tümü',
  sports: { football: 'Futbol', tennis: 'Tenis', basketball: 'Basketbol' } satisfies Record<PickSport, string>,
  group: (sport: string, n: number) => `${sport} · ${n}`,
  noOutlook: '—',
  from: {
    similar: 'Benzerlerden',
    blind: 'Benzerlerden',
    radar: 'Radardan',
    card: 'Oyuncu kartından',
  } satisfies Record<PickSource, string>,
  remove: 'Kaldır',
  removeLabel: (name: string) => `${name} oyuncusunu kaldır`,
  outlook: 'Görünüm',
};
