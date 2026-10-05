// ── 数据来自后端（GET /api/pieces/{id}/phrases）──────────────────────────────
//   断句、轨道取舍（不展示临时轨与点状腔格）都由后端计算；前端只画图和交互。
//   model 是全应用共享的普通对象：loadModel() 取到数据后【原地填充】，
//   所以必须在任何读 model 的模块（useClock、各组件）被 import 之前 await 它，见 main.js。
export const model = {
  meta: { title: '', performer: '', source: '', video: '', span: [0, 0] },
  lines: [],      // = phrases（逗号级分句；字段与原 lines 兼容）
  breaths: [],    // 由各句的 breaths 按时间拼回
  tracks: [],
  sections: [],
  omitted: [],
  excluded: [],
  stats: {},
}

export async function loadModel(pieceId = 'xunmeng') {
  const url = `/api/pieces/${pieceId}/phrases`
  let res
  try {
    res = await fetch(url)
  } catch {
    throw new Error(`连不上后端（${url}）。请先运行 make up。`)
  }
  if (!res.ok) {
    let detail
    try { detail = (await res.json()).detail } catch { /* 不是 JSON：下面给出状态码 */ }
    throw new Error(typeof detail === 'string' ? detail : `后端返回 ${res.status}（${url}）。请用 make logs 查看后端日志。`)
  }
  const data = await res.json()
  Object.assign(model, data, {
    lines: data.phrases,
    breaths: data.phrases.flatMap((p) => p.breaths).sort((a, b) => a.t - b.t),
  })
  return model
}

// 给每个出现过的腔格/动作类型分配一个稳定的淡彩
const PALETTE = ['#c98a7d', '#7da08f', '#c2a86a', '#8194ab', '#a87fa0', '#9a9270',
  '#6fa0a8', '#bb8e63', '#8f7fae', '#86a877', '#bf8c6e', '#7e94a0']
const _color = {}; let _ci = 0
export function colorOf(type) {
  if (!(type in _color)) _color[type] = PALETTE[_ci++ % PALETTE.length]
  return _color[type]
}

// ── 查找：当前句（最后一个 start<=t；t 在首句之前返回 -1）─────────────────
export function bisectLine(t) {
  const L = model.lines
  if (!L.length || t < L[0].s) return -1
  let lo = 0, hi = L.length - 1, ans = 0
  while (lo <= hi) {
    const m = (lo + hi) >> 1
    if (L[m].s <= t) { ans = m; lo = m + 1 } else hi = m - 1
  }
  return ans
}

export function activeCharIdx(line, t) {
  if (!line) return -1
  return line.chars.findIndex((c) => t >= c.s && t < c.e)
}

// ── 当前正在发生的腔格/动作（决策改进 2b：精确到时间点，而非句级）────────
export function activeAttrs(t) {
  const out = []
  for (const tk of model.tracks) {
    for (const b of tk.blocks) {
      if (t >= b.s && t < b.e) out.push({ type: b.t, track: tk.name, color: colorOf(b.t) })
    }
  }
  return out
}
// 用于变更检测，避免每帧重建响应式数组
export function attrsKey(attrs) { return attrs.map((a) => a.track + ':' + a.type).join('|') }

// 最近是否「正经过一个呼吸点」（用于阅读栏的瞬时气口提示）
export function breathAt(t, prev) {
  // 若在 [prev, t] 区间内跨过某个呼吸时间，则返回该时间，否则 null
  for (const b of model.breaths) {
    if (b.t > prev && b.t <= t + 0.001) return b.t
  }
  return null
}
