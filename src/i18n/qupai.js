// 曲牌名在英文界面里只用带声调的拼音显示；不编造意译的曲牌名。
import { lang, warnOnce } from './index.js'

export const QUPAI = {
  懒画眉: 'Lǎn Huà Méi',
  忒忒令: 'Tè Tè Lìng',
  嘉庆子: 'Jiā Qìng Zǐ',
  尹令: 'Yǐn Lìng',
  玉交枝: 'Yù Jiāo Zhī',
  江儿水: 'Jiāng Ér Shuǐ',
  豆叶黄: 'Dòu Yè Huáng',
}

const TIP_EN = 'qupai — a named tune pattern'

export function qupaiLabel(name) {
  if (lang.value === 'zh') return `【${name}】`
  if (name in QUPAI) return QUPAI[name]
  warnOnce(`i18n: 曲牌「${name}」没有拼音，见 src/i18n/qupai.js`)
  return `【${name}】`
}

// 校订清单（src/data/reviews/）里不是曲牌名的区段标签
export const REVIEW_SECTIONS = {
  '视频引子／念白（曲牌待复核）': 'Video prelude / spoken (qupai to be verified)',
  '过场／念白（待复核）': 'Transition / spoken (to be verified)',
  '念白（待复核）': 'Spoken (to be verified)',
  尾声: 'Wěi Shēng (coda)',
}

/** 审阅抽屉的区段名：英文界面用拼音或英文标签，查不到的原样显示 */
export function qupaiName(name) {
  return lang.value === 'zh' ? name : QUPAI[name] ?? REVIEW_SECTIONS[name] ?? name
}

// 悬停提示：只在英文界面解释「曲牌」是什么
export function qupaiTip() {
  return lang.value === 'zh' ? '' : TIP_EN
}
