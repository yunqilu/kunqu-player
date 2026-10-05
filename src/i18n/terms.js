// 腔格等术语在英文界面里的显示：块上放拼音（py），悬停时放「拼音 (英文简释)」。
// 键是数据里的原文，包括标注者写的括号说明；没有 py 的条目只显示英文。
// 动作轨的标签（指、开扇、相……）不在这里：动作名始终保持中文。
import { lang, t, warnOnce } from './index.js'

export const TERMS = {
  滑音: { py: 'huá-yīn', en: 'glide between pitches' },
  滑腔: { py: 'huá-qiāng', en: 'sliding ornament' },
  擞腔: { py: 'sǒu-qiāng', en: 'tremolo ornament' },
  '擞腔（加花）': { py: 'sǒu-qiāng', en: 'tremolo ornament, embellished' },
  豁腔: { py: 'huō-qiāng', en: 'upward flick that releases a note' },
  嚯腔: { py: 'huò-qiāng', en: 'half-swallowed note in a falling line' },
  '工尺简谱不同步腔格 (嚯腔)': {
    py: 'huò-qiāng',
    en: 'half-swallowed note; the gongche and numbered scores disagree here',
  },
  叠腔: { py: 'dié-qiāng', en: 'repeated-note ornament' },
  掇腔: { py: 'duō-qiāng', en: 'stop, rest and carry ornament' },
  '橄榄腔（主要用于大于三拍的长音）': {
    py: 'gǎn-lǎn-qiāng',
    en: 'olive-shaped swell, soft–loud–soft; mainly on notes longer than three beats',
  },
  '口罕腔（仅限于上声字）': {
    py: 'hǎn-qiāng',
    en: 'swallowed drop; only on rising-tone (shǎng) syllables',
  },
  '断腔（逢入必断）': {
    py: 'duàn-qiāng',
    en: 'cut-off ornament; entering-tone syllables are always cut short',
  },
  装饰音: { py: 'zhuāng-shì-yīn', en: 'grace note' },
  打音: { py: 'dǎ-yīn', en: 'tapped grace note' },
  气口: { py: 'qì-kǒu', en: 'breath mark' },
  未知腔格: { en: 'unidentified ornament' },
  音高变化: { en: 'pitch change' },
}

function lookup(name) {
  if (lang.value === 'zh') return null
  const term = TERMS[name]
  if (!term) warnOnce(`i18n: 术语「${name}」没有英文，见 src/i18n/terms.js`)
  return term ?? null
}

/** 块上的短标签 */
export function termShort(name) {
  const term = lookup(name)
  return term ? term.py ?? term.en : name
}

/** 悬停提示里的完整说明 */
export function termFull(name) {
  const term = lookup(name)
  if (!term) return name
  return term.py ? `${term.py} (${term.en})` : term.en
}

// —— 轨道 ——
const TRACK_KEY = { 腔格轨: 'track.qiangge', 动作: 'track.action' }
export const isMovementTrack = (name) => name === '动作'
export function trackLabel(name) {
  return lang.value !== 'zh' && name in TRACK_KEY ? t(TRACK_KEY[name]) : name
}

// —— 逐字的演唱方式 ——
const STYLE_KEY = { 普通唱: 'style.sung', 念白式: 'style.speech' }
export function styleLabel(style) {
  return style in STYLE_KEY ? t(STYLE_KEY[style]) : style
}
