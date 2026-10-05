import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import en from '../src/i18n/en.js'
import zh from '../src/i18n/zh.js'
import { QUPAI, qupaiLabel, qupaiTip } from '../src/i18n/qupai.js'
import { TERMS, isMovementTrack, termFull, termShort } from '../src/i18n/terms.js'
import { PLAY_INFO, PLAY_INFO_EN, playInfo } from '../src/data/meta.js'
import { initialLang, lang, setLang, t } from '../src/i18n/index.js'

const HAN = /[㐀-鿿]/
const memory = (initial = {}) => {
  const data = { ...initial }
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v) } }
}
const broken = {
  getItem() { throw new Error('denied') },
  setItem() { throw new Error('quota') },
}
const strings = (value) => (typeof value === 'string' ? [value] : Object.values(value).flatMap(strings))

beforeEach(() => setLang('en', null))
afterEach(() => vi.restoreAllMocks())

describe('message tables', () => {
  it('have exactly the same keys in both languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })

  it('have no Chinese characters in any English value', () => {
    const offenders = Object.entries(en).filter(([, value]) => HAN.test(value)).map(([key]) => key)

    expect(offenders).toEqual([])
  })

  it('use the same placeholders in both languages', () => {
    const holes = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    // 英文副标题里的演员和来源是写好的英文，不用中文的 meta 值
    const exempt = new Set(['header.subtitle'])
    const offenders = Object.keys(en).filter((key) => !exempt.has(key) && holes(en[key]).join() !== holes(zh[key]).join())

    expect(offenders).toEqual([])
  })
})

describe('initialLang', () => {
  it('defaults to English', () => {
    expect(initialLang('', memory())).toBe('en')
  })

  it('prefers the lang URL parameter over the stored choice', () => {
    expect(initialLang('?lang=zh', memory({ 'kunqu-player.lang': 'en' }))).toBe('zh')
  })

  it('uses the stored choice when the URL does not name a language', () => {
    expect(initialLang('?x=1', memory({ 'kunqu-player.lang': 'zh' }))).toBe('zh')
  })

  it('ignores unknown languages', () => {
    expect(initialLang('?lang=fr', memory({ 'kunqu-player.lang': 'de' }))).toBe('en')
  })

  it('survives storage that throws', () => {
    expect(initialLang('', broken)).toBe('en')
  })
})

describe('setLang', () => {
  it('switches the language and stores the choice', () => {
    const storage = memory()

    setLang('zh', storage)

    expect(lang.value).toBe('zh')
    expect(storage.data['kunqu-player.lang']).toBe('zh')
  })

  it('ignores unknown languages', () => {
    setLang('fr', memory())

    expect(lang.value).toBe('en')
  })

  it('still switches when storage throws', () => {
    setLang('zh', broken)

    expect(lang.value).toBe('zh')
  })
})

describe('t', () => {
  it('returns the text of the current language', () => {
    expect(t('kind.sung')).toBe('Sung')
    setLang('zh', null)
    expect(t('kind.sung')).toBe('唱')
  })

  it('fills {name} placeholders', () => {
    expect(t('left.phraseMany', { n: 3 })).toBe('3 phrases')
  })

  it('warns once and shows the key when a key exists in neither table', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(t('no.such.key')).toBe('no.such.key')
    t('no.such.key')

    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe('qupai names', () => {
  it('are shown as toned pinyin in English and in brackets in Chinese', () => {
    expect(qupaiLabel('懒画眉')).toBe('Lǎn Huà Méi')
    setLang('zh', null)
    expect(qupaiLabel('懒画眉')).toBe('【懒画眉】')
  })

  it('cover every qupai in the piece, without Chinese in the pinyin', () => {
    expect(Object.keys(QUPAI).sort()).toEqual(['嘉庆子', '尹令', '忒忒令', '懒画眉', '江儿水', '玉交枝', '豆叶黄'].sort())
    expect(Object.values(QUPAI).filter((v) => HAN.test(v))).toEqual([])
  })

  it('fall back to the Chinese name, with a warning, for an unknown qupai', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(qupaiLabel('山坡羊')).toBe('【山坡羊】')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('explain what a qupai is on hover, in English only', () => {
    expect(qupaiTip()).toBe('qupai — a named tune pattern')
    setLang('zh', null)
    expect(qupaiTip()).toBe('')
  })
})

describe('ornament terms', () => {
  const inData = [
    '滑音', '未知腔格', '豁腔', '擞腔', '装饰音', '擞腔（加花）', '工尺简谱不同步腔格 (嚯腔)',
    '橄榄腔（主要用于大于三拍的长音）', '口罕腔（仅限于上声字）', '嚯腔', '断腔（逢入必断）', '滑腔',
    '叠腔', '掇腔', '打音', '音高变化', '气口',
  ]

  it('cover every ornament label in the data', () => {
    expect(inData.filter((name) => !(name in TERMS))).toEqual([])
  })

  it('have no Chinese in the English forms', () => {
    expect(Object.values(TERMS).flatMap(strings).filter((v) => HAN.test(v))).toEqual([])
  })

  it('show pinyin on blocks and pinyin with a gloss on hover', () => {
    expect(termShort('擞腔')).toBe('sǒu-qiāng')
    expect(termFull('擞腔')).toBe('sǒu-qiāng (tremolo ornament)')
  })

  it('stay Chinese in the Chinese interface', () => {
    setLang('zh', null)

    expect(termShort('擞腔')).toBe('擞腔')
    expect(termFull('断腔（逢入必断）')).toBe('断腔（逢入必断）')
  })

  it('show an unknown term unchanged and warn once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(termShort('某腔')).toBe('某腔')
    termFull('某腔')

    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('recognise the movement track, whose labels stay Chinese', () => {
    expect(isMovementTrack('动作')).toBe(true)
    expect(isMovementTrack('腔格轨')).toBe(false)
  })
})

describe('play info', () => {
  it('follows the language', () => {
    expect(playInfo()).toBe(PLAY_INFO_EN)
    setLang('zh', null)
    expect(playInfo()).toBe(PLAY_INFO)
  })

  it('has the same fields in English, with no Chinese', () => {
    expect(PLAY_INFO_EN.fields).toHaveLength(PLAY_INFO.fields.length)
    expect(strings(PLAY_INFO_EN).filter((v) => HAN.test(v))).toEqual([])
  })
})
