// ============================================================================
// 工尺谱渲染核心 — 对齐 Xiqu-Annotation-System 的解析与 CSS class 体系
// ============================================================================

export const GONGCHE_FONT = 'GCNSymbolKai'

// 基字 → pinyin（用于 CSS class 名：gcn-s-{pinyin}）
const BASE_PINYIN = {
  合: 'he', 四: 'si', 一: 'one',
  上: 'shang', 尺: 'che', 工: 'gong', 凡: 'fan',
  六: 'liu', 五: 'wu', 乙: 'yi',
}

// 腔格字母 → pinyin（用于 CSS class 名）
const ORN_PINYIN = { h: 'huoqiang', s: 'souqiang', d: 'dieqiang', c: 'cuoqiang' }
const ZERO_TIME_TEXTS = new Set(['/', 'h'])

// 腔格字母 → 中文标签（用于提示/时间轴 title）
export const ORN_LABEL = { h: '豁腔', s: '擞腔', d: '叠腔', c: '掇腔' }

/**
 * 获取基字 + 音区对应的 CSS class 后缀（如 "shang-h", "gong-l", "liu"）
 */
function noteClassSuffix(base, register) {
  const pinyin = BASE_PINYIN[base]
  if (!pinyin) return null
  if (register === 1) return `${pinyin}-h`
  if (register === -1) return `${pinyin}-l`
  return pinyin
}

/**
 * 把 kunqu-player 预解析的工尺符号数组 → Xiqu 风格的平面 notes 列表
 *
 * Xiqu 的关键行为：
 *  1. 腔格字母 (h/s/d/c) 是独立的 note，有自己的 CSS class（gcn-s-huoqiang 等）
 *  2. 气口 / 不创建新 note，而是回写到前一个非零时长主音上
 *  3. 旁注/小音带 .lyrics-side-note class
 */
export function toRenderNotes(symbols) {
  if (!symbols || !symbols.length) return []

  const notes = []
  for (const s of symbols) {
    // pitch note
    const cssSuffix = noteClassSuffix(s.b, s.r)
    notes.push({
      text: s.b,
      noteClass: cssSuffix ? `gcn-s-${cssSuffix}` : null,
      side: !!s.p,
      beats: s.bt || '',
      _s: s.s,
      _e: s.e,
    })

    // 腔格字母 → 独立 notes
    for (const c of (s.o || '')) {
      const ornPinyin = ORN_PINYIN[c]
      notes.push({
        text: c,
        noteClass: ornPinyin ? `gcn-s-${ornPinyin}` : null,
        side: false,
        beats: '',
        _s: 0,
        _e: 0,
      })
    }

    // 气口 → 附着到前一个非零时长 note
    if (s.q) {
      for (let i = notes.length - 1; i >= 0; i--) {
        if (!ZERO_TIME_TEXTS.has(notes[i].text)) {
          notes[i].qikou = true
          break
        }
      }
    }
  }
  return notes
}

/**
 * 获取板眼数字的 CSS class 名（如 "gcn-s-beat-3"）
 */
export function beatClass(digit) {
  return `gcn-s-beat-${digit}`
}

/**
 * 合并相邻 dieqiang notes 的标记（用于 .adj-dieqiang class）
 */
export function markAdjacentDieqiang(notes) {
  for (let i = 0; i < notes.length; i++) {
    if (notes[i].noteClass === 'gcn-s-dieqiang') {
      if (notes[i - 1]?.noteClass === 'gcn-s-dieqiang' ||
          notes[i + 1]?.noteClass === 'gcn-s-dieqiang') {
        notes[i].adjDieqiang = true
      }
    }
  }
}
