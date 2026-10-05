// ── 界面语言 ────────────────────────────────────────────────────────────────
//   很小的 i18n：一个响应式的 lang，两张扁平的 key → 文案对照表（zh.js / en.js）。
//   t() 读 lang.value，所以在模板和 computed 里用它，切换语言时界面会自己更新。
//   唱词、动作名、工尺符号不走这里——它们始终是中文。
import { ref } from 'vue'
import en from './en.js'
import zh from './zh.js'

const TABLES = { en, zh }
const HTML_LANG = { en: 'en', zh: 'zh-CN' }
const KEY = 'kunqu-player.lang'
export const DEFAULT_LANG = 'en'

function defaultStorage() {
  try { return globalThis.localStorage ?? null } catch { return null }
}
function defaultSearch() {
  try { return globalThis.location?.search ?? '' } catch { return '' }
}

// 初始语言：URL 参数 ?lang= → 上次的选择 → 英文
export function initialLang(search = defaultSearch(), storage = defaultStorage()) {
  let fromUrl = null
  try { fromUrl = new URLSearchParams(search).get('lang') } catch { /* 参数读不了：看下一个来源 */ }
  if (fromUrl in TABLES) return fromUrl
  try {
    const stored = storage.getItem(KEY)
    if (stored in TABLES) return stored
  } catch { /* 没有存储或被禁用：用默认值 */ }
  return DEFAULT_LANG
}

export const lang = ref(initialLang())

const warned = new Set()
export function warnOnce(message) {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(message)
}

export function t(key, params = {}) {
  let text = TABLES[lang.value][key]
  if (text === undefined) {
    warnOnce(`i18n: 缺少文案 ${key}（${lang.value}）`)
    text = zh[key] ?? key
  }
  return text.replace(/\{(\w+)\}/g, (hole, name) => (name in params ? String(params[name]) : hole))
}

function applyToDocument() {
  if (typeof document === 'undefined') return
  document.documentElement.lang = HTML_LANG[lang.value]
  document.title = t('app.title')
}

export function setLang(next, storage = defaultStorage()) {
  if (!(next in TABLES)) return
  lang.value = next
  try { storage.setItem(KEY, next) } catch { /* 存不了就算了，本次仍然生效 */ }
  applyToDocument()
}

applyToDocument()
