<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { clock } from '../composables/useClock'
import { t } from '../i18n'

const props = defineProps({ showTimeline: Boolean })
const emit = defineEmits(['toggle-timeline'])

const { playing, rate, loopLine } = clock
const rates = [0.5, 0.75, 1, 1.5, 2]
const [t0, t1] = clock.span

const progEl = ref(null), knobEl = ref(null), timeEl = ref(null), seekEl = ref(null)
let unsub = null
const fmt = (s) => { s = Math.max(0, s || 0); const m = (s / 60) | 0, x = (s % 60) | 0; return `${m}:${String(x).padStart(2, '0')}` }

onMounted(() => {
  // 命令式：进度条/时间文字每帧直写 DOM，不触发 Vue 重渲染
  unsub = clock.onFrame((t) => {
    const dur = clock.duration()
    const f = (t - t0) / Math.max(0.001, dur - t0)
    if (progEl.value) progEl.value.style.width = f * 100 + '%'
    if (knobEl.value) knobEl.value.style.left = f * 100 + '%'
    if (timeEl.value) timeEl.value.textContent = `${fmt(t)} / ${fmt(dur)}`
  })
})
onUnmounted(() => unsub && unsub())

let dragging = false
const seekFrom = (e) => {
  const r = seekEl.value.getBoundingClientRect()
  const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
  clock.seek(t0 + f * (clock.duration() - t0))
}
const onDown = (e) => { dragging = true; seekFrom(e); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp) }
const onMove = (e) => dragging && seekFrom(e)
const onUp = () => { dragging = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
</script>

<template>
  <div class="transport">
    <button class="tb" :title="t('transport.back5')" @click="clock.seek(clock.getTime() - 5)">⟲</button>
    <button class="tb play" :title="t('transport.playPause')" @click="clock.togglePlay()">{{ playing ? '❚❚' : '▶' }}</button>
    <button class="tb" :title="t('transport.forward5')" @click="clock.seek(clock.getTime() + 5)">⟳</button>

    <div class="seek" ref="seekEl" @mousedown="onDown">
      <div class="prog" ref="progEl"></div>
      <div class="knob" ref="knobEl"></div>
    </div>
    <div class="time" ref="timeEl">0:00 / 0:00</div>

    <div class="rate">
      <button v-for="r in rates" :key="r" :class="{ on: r === rate }" @click="clock.setRate(r)">{{ r }}×</button>
    </div>
    <label class="tg"><input type="checkbox" v-model="loopLine" /> {{ t('transport.loop') }}</label>
    <label class="tg"><input type="checkbox" :checked="showTimeline" @change="emit('toggle-timeline')" /> {{ t('transport.timeline') }}</label>
  </div>
</template>

<style scoped>
.transport { display: flex; align-items: center; gap: 11px; padding: 7px 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 24px; }
.tb { border: none; background: none; font-size: 16px; color: var(--ink); padding: 3px 5px; border-radius: 50%; line-height: 1; }
.tb:hover { color: var(--zhu); }
.tb.play { font-size: 19px; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; }
.seek { flex: 1; height: 4px; background: var(--line); border-radius: 3px; position: relative; cursor: pointer; }
.prog { position: absolute; inset: 0 auto 0 0; width: 0; background: var(--zhu); border-radius: 3px; }
.knob { position: absolute; top: 50%; left: 0; width: 12px; height: 12px; border-radius: 50%; background: var(--zhu); transform: translate(-50%, -50%); box-shadow: 0 1px 4px #0004; }
.time { font-family: var(--num); font-size: 12.5px; color: var(--ink-soft); min-width: 92px; text-align: right; font-variant-numeric: tabular-nums; }
.rate { display: flex; gap: 3px; }
.rate button { font-family: var(--num); font-size: 11.5px; border: 1px solid var(--line); background: #fff8; border-radius: 11px; padding: 1px 7px; color: var(--ink-soft); }
.rate button.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.tg { font-size: 12px; color: var(--ink-soft); display: inline-flex; gap: 4px; align-items: center; white-space: nowrap; }
</style>
