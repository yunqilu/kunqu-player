<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { model, colorOf } from '../lib/model'
import { clock } from '../composables/useClock'
import { t } from '../i18n'
import { isMovementTrack, styleLabel, termFull, termShort, trackLabel } from '../i18n/terms'

const { activeLineIdx, activeCharIdx, playing } = clock
const [t0, t1] = clock.span
const LABEL_W = 54
const BASE_PPS = 10
const zoom = ref(1)
const pps = computed(() => BASE_PPS * zoom.value)
const innerW = computed(() => LABEL_W + (t1 - t0) * pps.value + 40)
const X = (t) => LABEL_W + (t - t0) * pps.value
const W = (a, b) => Math.max(7, (b - a) * pps.value)
// 腔格名随界面语言显示；动作轨的块和点始终是中文
const blockLabel = (tk, b) => (isMovementTrack(tk.name) ? b.t : termShort(b.t))
const blockTitle = (tk, b) => (isMovementTrack(tk.name) ? b.t : termFull(b.t))
const pointTitle = (tk, p) => (isMovementTrack(tk.name) ? p.l : termFull(p.l))
const fmt = (s) => { s = Math.max(0, s || 0); const m = (s / 60) | 0, x = (s % 60) | 0; return `${m}:${String(x).padStart(2, '0')}` }

const ticks = computed(() => {
  const out = []
  for (let s = Math.ceil(t0 / 30) * 30; s < t1; s += 30) out.push({ s, x: X(s) })
  return out
})

const scrollEl = ref(null), playheadEl = ref(null)
let unsub = null
onMounted(() => {
  unsub = clock.onFrame((t) => {
    const x = X(t)
    if (playheadEl.value) playheadEl.value.style.transform = `translateX(${x}px)`
    // ── 自动跟踪修复（决策改进 1d）──
    // 仅在播放时跟踪；把播放头钉在视口约 40% 处；并 clamp 到可滚动范围，
    // 末尾不再越界，光标始终可见；暂停时不自动滚动，允许用户自由查看。
    if (playing.value && scrollEl.value) {
      const sc = scrollEl.value
      const vw = sc.clientWidth
      const max = Math.max(0, innerW.value - vw)
      sc.scrollLeft = Math.max(0, Math.min(max, x - vw * 0.4))
    }
  })
})
onUnmounted(() => unsub && unsub())

const zoomIn = () => (zoom.value = Math.min(8, zoom.value * 1.5))
const zoomOut = () => (zoom.value = Math.max(0.3, zoom.value / 1.5))
const onDblTrack = (e) => {
  if (e.target.closest('[data-seek]')) return
  const r = e.currentTarget.getBoundingClientRect()
  const px = e.clientX - r.left + scrollEl.value.scrollLeft
  clock.seek(t0 + (px - LABEL_W) / pps.value)
}
</script>

<template>
  <div class="tl">
    <div class="tl-hd">
      <h3>{{ t('timeline.title') }}</h3>
      <div class="zoom">{{ t('timeline.zoom') }}<button @click="zoomOut">−</button><button @click="zoomIn">＋</button></div>
      <span class="hint">{{ t('timeline.hint') }}</span>
    </div>

    <div class="tl-scroll" ref="scrollEl">
      <div class="tl-inner" :style="{ width: innerW + 'px' }" @dblclick="onDblTrack">
        <div class="ruler">
          <span class="lbl"></span>
          <span v-for="tk in ticks" :key="tk.s" class="tick" :style="{ left: tk.x + 'px' }">{{ fmt(tk.s) }}</span>
        </div>

        <!-- 字轨 -->
        <div class="lane" style="--h:26px">
          <span class="lbl">{{ t('timeline.textLane') }}</span>
          <template v-for="(l, li) in model.lines" :key="l.id">
            <div
              v-for="(c, ci) in l.chars" :key="ci"
              class="blk char" :class="{ nianbai: c.st === '念白式', active: li === activeLineIdx && ci === activeCharIdx }"
              :style="{ left: X(c.s) + 'px', width: W(c.s, c.e) + 'px' }"
              :data-seek="c.s" :title="t('flow.charPlain', { ch: c.ch, style: styleLabel(c.st) })" @click="clock.seek(c.s)">{{ c.ch }}</div>
          </template>
        </div>

        <!-- 呼吸轨 -->
        <div class="lane pts" style="--h:18px">
          <span class="lbl">{{ t('track.breath') }}</span>
          <div v-for="(p, i) in model.breaths" :key="i" class="pt" :style="{ left: X(p.t) + 'px' }"
            :data-seek="p.t" :title="t('flow.breathAt', { time: fmt(p.t) })" @click="clock.seek(p.t)"><i class="dot breath"></i></div>
        </div>

        <!-- 腔格轨 / 动作轨（保留的自定义轨）-->
        <div v-for="tk in model.tracks" :key="tk.id" class="lane" style="--h:26px">
          <span class="lbl">{{ trackLabel(tk.name) }}</span>
          <div v-for="(b, i) in tk.blocks" :key="'b' + i" class="blk attr"
            :style="{ left: X(b.s) + 'px', width: W(b.s, b.e) + 'px', background: colorOf(b.t) }"
            :data-seek="b.s" :title="blockTitle(tk, b)" @click="clock.seek(b.s)">{{ blockLabel(tk, b) }}</div>
          <div v-for="(p, i) in tk.points" :key="'p' + i" class="pt" :style="{ left: X(p.t) + 'px' }"
            :data-seek="p.t" :title="pointTitle(tk, p)" @click="clock.seek(p.t)"><i class="dot act"></i></div>
        </div>

        <div class="playhead" ref="playheadEl"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tl { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; height: 100%; }
.tl-hd { display: flex; align-items: center; gap: 12px; padding: 2px 2px 6px; }
.tl-hd h3 { margin: 0; font-size: 13.5px; letter-spacing: .1em; color: var(--ink-soft); font-weight: 600; }
.zoom { display: flex; gap: 4px; align-items: center; font-size: 11.5px; color: var(--dai); }
.zoom button { border: 1px solid var(--line); background: #fff8; border-radius: 7px; width: 22px; height: 20px; color: var(--ink-soft); }
.hint { font-size: 11px; color: var(--dai); margin-left: auto; }

.tl-scroll { overflow: auto; border: 1px solid var(--line); border-radius: 8px; background: #fcf9f2; }
.tl-inner { position: relative; }
.ruler { height: 18px; position: relative; border-bottom: 1px solid var(--line); background: #f6f1e6; }
.tick { position: absolute; top: 0; bottom: 0; border-left: 1px solid #d8cdb4; font-size: 9px; color: var(--dai); padding-left: 3px; font-family: var(--num); }
.lane { position: relative; height: var(--h, 26px); border-bottom: 1px solid var(--line-2); }
.lane:last-of-type { border-bottom: none; }
.lbl { position: sticky; left: 0; z-index: 3; display: inline-flex; align-items: center; height: 100%; padding: 0 7px;
  font-size: 11px; color: var(--dai); background: linear-gradient(90deg, #fcf9f2 78%, #fcf9f200); min-width: 54px; letter-spacing: .04em; }
.blk { position: absolute; top: 3px; bottom: 3px; border-radius: 3px; font-size: 11px; display: flex; align-items: center;
  padding: 0 4px; overflow: hidden; white-space: nowrap; color: #241f17; border: 1px solid #0001; cursor: pointer; }
.blk:hover { filter: brightness(1.05); outline: 1px solid var(--zhu); }
.blk.char { top: 4px; bottom: 4px; background: #efe7d6; justify-content: center; font-size: 13px; }
.blk.char.nianbai { background: #e9e9e3; color: #7a766c; }
.blk.char.active { outline: 1.5px solid var(--zhu); background: #f6e3df; color: var(--zhu); z-index: 2; }
.pt { position: absolute; top: 50%; width: 0; height: 0; cursor: pointer; }
.dot { position: absolute; left: 0; top: 0; width: 8px; height: 8px; border-radius: 50%; transform: translate(-50%, -50%); border: 1px solid #fff; }
.dot.breath { background: var(--qing); }
.dot.act { background: var(--zhu); }
.pt:hover .dot { transform: translate(-50%, -50%) scale(1.4); }
.playhead { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--zhu); z-index: 4; pointer-events: none; left: 0; box-shadow: 0 0 6px rgba(178, 58, 46, .5); }
.playhead::before { content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%);
  border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 7px solid var(--zhu); }
</style>
