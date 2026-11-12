import type { AccountError, PickSource, PickSport } from '../../account';
import type { Loose } from '../../i18n';
import type * as en from '../en/account';

/** 登录、“我的选择”页面和页眉标签的全部文字。 */
export const account: Loose<typeof en.account> = {
  kicker: '账号',
  title: '你的球探账号',
  switchLabel: '登录或注册',
  modeLogin: '登录',
  modeRegister: '注册',
  nameLabel: '用户名',
  passwordLabel: '密码',
  submitLogin: '登录',
  submitRegister: '注册',
  errors: {
    name: '用户名至少需要 2 个字符。',
    password: '密码至少需要 4 个字符。',
    taken: '这台电脑上已有这个用户名。请直接登录。',
    wrong: '用户名或密码不正确。',
  } satisfies Record<AccountError, string>,
  caption: '账号只保存在这个浏览器里。没有服务器，所以在这里注册的账号在另一台电脑上不存在。',
  signedIn: (name: string) => `已登录：${name}`,
  toPicks: '前往我的选择',
  logout: '退出登录',
  header: {
    login: '登录',
    picks: '我的选择',
    loginTip: '登录或注册',
  },
};

export const myPicks: Loose<typeof en.myPicks> = {
  kicker: '我的选择',
  signedOutTitle: '登录后才能保存你的选择。',
  signedOutText: '名单会保存给当前登录的球探。',
  signedOutAction: '登录',
  title: (n: number) => (n === 0 ? '你的名单是空的。' : `你的名单里有 ${n} 名球员。`),
  emptyText: '从盲选、雷达或球员卡片中添加球员。',
  lede: (name: string) => `球探：${name}`,
  filterLabel: '显示项目',
  all: '全部',
  sports: { football: '足球', tennis: '网球', basketball: '篮球' } satisfies Record<PickSport, string>,
  group: (sport: string, n: number) => `${sport} · ${n}`,
  noOutlook: '—',
  from: {
    blind: '来自盲选',
    radar: '来自雷达',
    card: '来自球员卡片',
  } satisfies Record<PickSource, string>,
  remove: '移除',
  removeLabel: (name: string) => `移除 ${name}`,
  outlook: '前景',
};
