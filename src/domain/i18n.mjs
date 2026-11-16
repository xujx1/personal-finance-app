import english from '../i18n/en.json' with {type:'json'};

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'];
export const LOCALE_STORAGE_KEY = 'family-finance.locale';
export const DEFAULT_LOCALE = 'zh-CN';
/** @type {Record<string,string>} */
export const englishMessages = english;

export function normalizeLocale(value) {
  if (typeof value !== 'string') return null;
  if (/^en(?:[-_]|$)/i.test(value)) return 'en-US';
  if (/^zh(?:[-_]|$)/i.test(value)) return 'zh-CN';
  return null;
}

export function preferredLocale(saved, languages = []) {
  return normalizeLocale(saved) ?? languages.map(normalizeLocale).find(Boolean) ?? DEFAULT_LOCALE;
}

/** Only call for application-owned interface messages, never arbitrary record content. */
export function translate(message, values = {}, locale = DEFAULT_LOCALE) {
  if (message == null) return message;
  const key = String(message ?? '');
  const template = locale === 'en-US' && Object.hasOwn(englishMessages, key) ? englishMessages[key] : key;
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (token, name) =>
    Object.hasOwn(values, name) ? String(values[name] ?? '') : token);
}

let patterns;
/** Error/status text from application services; does not translate financial records. */
export function translateMessage(message, locale = DEFAULT_LOCALE) {
  const text = String(message ?? '');
  if (locale !== 'en-US' || !text) return text;
  if (Object.hasOwn(englishMessages, text)) return englishMessages[text];
  if (text.startsWith('CONFLICT:')) return translate('数据已变化，请刷新后重新核对。', {}, locale);
  if (!patterns) patterns = Object.keys(englishMessages).filter(key => /\{p\d+\}/.test(key)).map(key => {
    const names = [];
    const parts = key.split(/(\{p\d+\})/).map(part => {
      if (/^\{p\d+\}$/.test(part)) { names.push(part.slice(1, -1)); return '([\\s\\S]*?)'; }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    return {key, names, pattern:new RegExp('^' + parts.join('') + '$')};
  });
  for (const entry of patterns) {
    const match = entry.pattern.exec(text);
    if (match) return translate(entry.key, Object.fromEntries(entry.names.map((name, i) => [name, match[i + 1]])), locale);
  }
  if (text.includes('。')) return text.split('。').filter(Boolean).map(part => englishMessages[part] ?? part).join(' ');
  return text;
}

export function formatMinorDecimal(value, locale = DEFAULT_LOCALE) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return translate('未知', {}, locale);
  const cents = BigInt(value), absolute = cents < 0n ? -cents : cents;
  return (cents < 0n ? '-' : '') + (absolute / 100n).toLocaleString(locale) + '.' + String(absolute % 100n).padStart(2, '0');
}

export function formatMinor(value, currency = 'CNY', locale = DEFAULT_LOCALE) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return translate('未知', {}, locale);
  const formatted = formatMinorDecimal(value, locale);
  const symbol = currency === 'CNY' ? (locale === 'en-US' ? 'CN¥' : '¥') : currency === 'USD' ? (locale === 'en-US' ? '$' : 'US$') : currency + ' ';
  return (value < 0 ? '-' : '') + symbol + (value < 0 ? formatted.slice(1) : formatted);
}

export function formatCalendarDate(value, locale = DEFAULT_LOCALE, options = {}) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value ?? '';
  // Business dates are date-only values: changing language must never move their day.
  const date = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== value) return value;
  return new Intl.DateTimeFormat(locale, {year:'numeric', month:'short', day:'numeric', ...options, timeZone:'UTC'}).format(date);
}

// These labels belong to system-defined types. Preserve all user-defined names,
// including renamed built-ins and user text equal to an interface label.
const BUILTIN_NAMES = {
  cash:'银行现金',term_deposit:'银行定期存款',treasury:'国债',stock:'股票证券',stock_index:'证券指数ETF',fund:'基金',
  broad_index:'宽基指数基金',treasury_fund:'国债基金',metals_fund:'贵金属基金',metals:'黄金与贵金属',
  property:'房产',loan:'住房贷款',other:'其他资产',prepayment:'预付款资产',personal_pension:'个人养老金',
};
export function assetTypeLabel(type, locale = DEFAULT_LOCALE) {
  if (!type) return undefined;
  return type.builtin && BUILTIN_NAMES[type.id] === type.name ? translate(type.name, {}, locale) : type.name;
}

export function memberLabel(member, locale = DEFAULT_LOCALE) {
  if (member?.id === 'unknown' && member.name === '归属待确认') return translate(member.name, {}, locale);
  return member?.id === 'family' && member.name === '家庭共用' ? translate('家庭共用', {}, locale) : member?.name ?? '';
}

const PLAN_CATEGORIES = new Set(['国内旅行','国际旅行','餐饮','大件采购','宝宝教育及托育','保险保障','医疗支出','提前还贷','其他']);
export function planCategoryLabel(value, locale = DEFAULT_LOCALE) {
  return PLAN_CATEGORIES.has(value) ? translate(value, {}, locale) : value;
}
