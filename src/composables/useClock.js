import { ref, shallowRef } from 'vue'
import { model, bisectLine, activeCharIdx, activeAttrs, attrsKey, breathAt } from '../lib/model'
import { subtitleIndex } from '../lib/subtitle'

// ── 单一时钟源（整个应用共享一个实例）───────────────────────────────────────
// 性能纪律：
//   · currentTime 每帧都在变，但它本身【不进响应式】（保存为普通变量 + getTime()）。
//   · 播放头位置 / 进度条 / 时间文字 → 通过 onFrame() 订阅，由组件【命令式】直写 DOM。
//   · 只有「当前句/字/符号/腔格」这些离散索引在【真正变化】时才写响应式 ref，
//     从而把 Vue 的重渲染压到最低（每秒最多几次）。
function createClock() {
  const [t0, t1] = model.meta.span

  // —— 响应式：仅离散状态，change-guarded ——
  const activeLineIdx = ref(-1)
  const activePhraseOn = ref(false)   // 此刻是否在当前句的 [s, e) 之内（句后的过门里为 false）
  const subtitleIdx = ref(-1)         // 字幕该显示的句；短空隙里沿用前一句，见 lib/subtitle.js
  const activeCharIdxRef = ref(-1)
  const activeSymIdx = ref(-1)
  const activeAttrsRef = shallowRef([])
  const breathPulse = ref(0)
  const playing = ref(false)
  const rate = ref(1)
  const hasVideo = ref(false)
  const loopLine = ref(false)

  // —— 非响应式运行态 ——
  let videoEl = null
  let vTime = t0          // 虚拟时间（无视频时）
  let lastWall = 0
  let prevT = t0
  let attrKeyCache = ''
  let raf = 0
  const frameSubs = new Set()

  const getTime = () => (hasVideo.value && videoEl ? videoEl.currentTime : vTime)
  const duration = () => (hasVideo.value && videoEl && videoEl.duration ? videoEl.duration : t1)

  function recompute(t) {
    // 句
    const li = bisectLine(t)
    if (li !== activeLineIdx.value) {
      activeLineIdx.value = li
      activeCharIdxRef.value = -1
      activeSymIdx.value = -1
    }
    // 字 + 符号
    const line = li >= 0 ? model.lines[li] : null
    const on = !!line && t < line.e
    if (on !== activePhraseOn.value) activePhraseOn.value = on
    const sub = subtitleIndex(model.lines, t)
    if (sub !== subtitleIdx.value) subtitleIdx.value = sub
    const ci = activeCharIdx(line, t)
    if (ci !== activeCharIdxRef.value) activeCharIdxRef.value = ci
    let si = -1
    if (line && ci >= 0) {
      const gc = line.chars[ci].gc
      si = gc.findIndex((s) => t >= s.s && t < s.e)
    }
    if (si !== activeSymIdx.value) activeSymIdx.value = si
    // 腔格/动作（精确到时间点）
    const attrs = activeAttrs(t)
    const key = attrsKey(attrs)
    if (key !== attrKeyCache) { attrKeyCache = key; activeAttrsRef.value = attrs }
    // 呼吸（跨过呼吸点时脉冲一次）
    const br = breathAt(t, prevT)
    if (br != null) breathPulse.value = br
    prevT = t
  }

  function frame(now) {
    if (hasVideo.value && videoEl) {
      vTime = videoEl.currentTime
    } else if (playing.value) {
      const dt = lastWall ? (now - lastWall) / 1000 : 0
      lastWall = now
      vTime = Math.min(t1, vTime + dt * rate.value)
      if (vTime >= t1) setPlaying(false)
    }
    const t = getTime()
    // 循环本句
    if (loopLine.value && activeLineIdx.value >= 0) {
      const l = model.lines[activeLineIdx.value]
      if (t >= l.e) { seek(l.s); raf = requestAnimationFrame(frame); return }
    }
    recompute(t)
    frameSubs.forEach((cb) => cb(t))           // 命令式：播放头/进度/时间
    raf = requestAnimationFrame(frame)
  }

  // —— 控制 ——
  function setPlaying(p) {
    playing.value = p
    lastWall = 0
    if (hasVideo.value && videoEl) { p ? videoEl.play().catch(() => {}) : videoEl.pause() }
  }
  function togglePlay() { setPlaying(!playing.value) }
  function seek(t) {
    t = Math.max(t0, Math.min(duration(), t))
    if (hasVideo.value && videoEl) videoEl.currentTime = t
    else vTime = t
    prevT = t
    lastWall = 0
    recompute(t)
    frameSubs.forEach((cb) => cb(t))
  }
  function setRate(r) {
    rate.value = r
    if (hasVideo.value && videoEl) videoEl.playbackRate = r
  }
  function attachVideo(el) {
    videoEl = el; hasVideo.value = true
    el.playbackRate = rate.value
    el.addEventListener('play', () => (playing.value = true))
    el.addEventListener('pause', () => (playing.value = false))
  }
  function onFrame(cb) { frameSubs.add(cb); cb(getTime()); return () => frameSubs.delete(cb) }

  function start() { raf = requestAnimationFrame(frame); seek(t0) }
  function stop() { cancelAnimationFrame(raf) }

  return {
    // 响应式
    activeLineIdx, activePhraseOn, subtitleIdx, activeCharIdx: activeCharIdxRef, activeSymIdx,
    activeAttrs: activeAttrsRef, breathPulse, playing, rate, hasVideo, loopLine,
    // 方法
    getTime, duration, togglePlay, setPlaying, seek, setRate, attachVideo, onFrame, start, stop,
    span: model.meta.span,
  }
}

export const clock = createClock()
