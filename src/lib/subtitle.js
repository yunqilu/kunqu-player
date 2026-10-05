// ── 逐句英文字幕：此刻该显示哪一句 ──────────────────────────────────────────
//   纯函数，只看时间，所以拖动进度条、往回跳之后结果自然是对的。
//   一句唱完就隐藏；但两句之间的空隙不到 BRIDGE_GAP 秒时不隐藏，
//   前一句一直留到后一句开始，免得连续的短句（秀才｜秀才）之间字幕闪烁。

export const BRIDGE_GAP = 0.4
const EPSILON = 1e-6 // 时间是浮点数：25.4 - 25 略小于 0.4，不能因此算作短空隙

/** @returns 该显示的分句下标；不该显示字幕时为 -1 */
export function subtitleIndex(lines, t, bridge = BRIDGE_GAP) {
  let lo = 0, hi = lines.length - 1, i = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].s <= t) { i = mid; lo = mid + 1 } else hi = mid - 1
  }
  if (i < 0) return -1
  if (t < lines[i].e) return i
  const next = lines[i + 1]
  return next && next.s - lines[i].e < bridge - EPSILON ? i : -1
}

// —— 字幕开关，存在 localStorage 里；存储不可用时读写都不能抛错 ——
const KEY = 'kunqu-player.subtitles'

function defaultStorage() {
  try { return globalThis.localStorage ?? null } catch { return null }
}

export function loadSubtitlePref(storage = defaultStorage()) {
  try { return storage.getItem(KEY) !== 'off' } catch { return true }
}

export function saveSubtitlePref(on, storage = defaultStorage()) {
  try { storage.setItem(KEY, on ? 'on' : 'off') } catch { /* 存不了就算了，开关本次仍有效 */ }
}
