// 时长排版：一个分句排成一行，字块宽度随演唱时长变化。
// 行内一律以时间定位——每个字块、每段停顿各占一「段」，段内按时间线性插值，
// 工尺音、腔格、动作、呼吸都用同一个 时间 → x 映射。

export const W_MIN = 28       // 约一个字宽
export const K_DEFAULT = 18   // px/√s，所有行共用
const GAP_MIN = 0.05          // 小于这个的字间停顿不画
const TAIL_MAX = 3            // 句尾停顿最多按这么多秒算宽度

/**
 * @param phrase    {s, e, chars[{s, e}]}
 * @param maxWidth  容器可用宽度；超出时缩小这一行的 K，保证一句只占一行
 * @param tailEnd   下一句的开始时间；句尾到它之间的停顿画成行尾的空白
 * @returns {segments[{kind: 'char'|'gap'|'tail', ci?, t0, t1, x0, x1}], width, k, scale}
 */
export function layoutPhrase(phrase, { k = K_DEFAULT, wMin = W_MIN, maxWidth = Infinity, tailEnd = null } = {}) {
  const spans = []
  phrase.chars.forEach((c, ci) => {
    const prev = phrase.chars[ci - 1]
    if (prev && c.s - prev.e >= GAP_MIN) spans.push({ kind: 'gap', t0: prev.e, t1: c.s, base: 0, root: Math.sqrt(c.s - prev.e) })
    spans.push({ kind: 'char', ci, t0: c.s, t1: c.e, base: wMin, root: Math.sqrt(Math.max(0, c.e - c.s)) })
  })
  if (tailEnd != null && tailEnd - phrase.e >= GAP_MIN) {
    spans.push({ kind: 'tail', t0: phrase.e, t1: tailEnd, base: 0, root: Math.sqrt(Math.min(TAIL_MAX, tailEnd - phrase.e)) })
  }

  const base = spans.reduce((sum, g) => sum + g.base, 0)
  const roots = spans.reduce((sum, g) => sum + g.root, 0)
  let scale = 1
  if (base + k * roots > maxWidth) {
    k = roots > 0 ? Math.max(0, (maxWidth - base) / roots) : 0
    if (base > maxWidth) scale = maxWidth / base   // 光是底宽就放不下：整行等比缩小
  }

  let x = 0
  const segments = spans.map(({ base: b, root, ...g }) => {
    const x0 = x
    x += b + k * root
    return { ...g, x0, x1: x }
  })
  return { segments, width: x, k, scale }
}

/** 时间 → 行内 x。行外的时间夹到行的两端；结果随时间单调不减。 */
export function timeToX(layout, t) {
  let x = 0
  for (const g of layout.segments) {
    if (t >= g.t1) { x = Math.max(x, g.x1); continue }
    if (t <= g.t0) return Math.max(x, g.x0)
    return Math.max(x, g.x0 + ((t - g.t0) / (g.t1 - g.t0)) * (g.x1 - g.x0))
  }
  return x
}

/** 一个时间区间在行内的位置和宽度：跨了几个字，就有多长。 */
export function spanX(layout, s, e, minW = 0) {
  const x = timeToX(layout, s)
  return { x, w: Math.max(minW, timeToX(layout, e) - x) }
}

/**
 * 按时间定位的小字形（工尺音）挤在一起时，错开到下一排，x 不变。
 * items 按 x 升序，每项 {x, need}（need = 字形实际要占的宽度）；写回 line，返回用到的排数。
 */
export function packLines(items, maxLines = 3) {
  const ends = []
  for (const item of items) {
    let line = ends.findIndex((end) => end <= item.x)
    if (line < 0) {
      if (ends.length < maxLines) line = ends.length
      else line = ends.indexOf(Math.min(...ends))   // 排满了：放到最不挤的一排
    }
    ends[line] = item.x + item.need
    item.line = line
  }
  return ends.length
}
