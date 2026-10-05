<script setup>
import { computed, onMounted, onUnmounted, onUpdated, reactive, ref, watch } from 'vue'
import { model, colorOf } from '../lib/model'
import { clock } from '../composables/useClock'
import { buildOutline } from '../lib/outline'
import { layoutPhrase, packLines, spanX, timeToX } from '../lib/flowLayout'
import { TRACKS, loadTrackPrefs, saveTrackPrefs } from '../lib/flowPrefs'
import { toRenderNotes, beatClass, ORN_LABEL } from '../lib/gongche'
import { lang, t } from '../i18n'
import { styleLabel, termFull, termShort } from '../i18n/terms'

// ── 时长排版视图 ─────────────────────────────────────────────────────────────
//   一个分句一行；行内一律以时间定位（见 lib/flowLayout.js）。
//   性能纪律同 useClock：播放头、当前句/字的高亮都【命令式】直写 DOM，
//   播放过程中不触发本组件重渲染（它有几千个节点）。
const { activeLineIdx, activeCharIdx } = clock

const GUTTER = 84   // 行首标注栏（要放得下拼音曲牌名，如 Jiāng Ér Shuǐ）
const SLACK = 22    // 行尾留白 + 滚动条
const BLOCK_MIN = 8 // 块的最小可点宽度
const NOTE_H = 19   // 工尺一排的高度

const fmt = (s) => { s = Math.max(0, s || 0); const m = (s / 60) | 0, x = (s % 60) | 0; return `${m}:${String(x).padStart(2, '0')}` }

// —— 轨道开关 ——
const show = reactive(loadTrackPrefs())
watch(show, () => saveTrackPrefs({ ...show }))

// —— 可用行宽（只在容器尺寸变化时更新）——
const scrollEl = ref(null)
const avail = ref(900)
let observer = null
function measure() {
  const w = (scrollEl.value?.clientWidth ?? 0) - GUTTER - SLACK
  if (w > 120) avail.value = w
}

// —— 每行的渲染模型 ——
const sectionLabel = computed(() => new Map(buildOutline(model).map((g) => [g.items[0].index, g])))

function charTitle(c, lyric) {
  if (c.src === 'variant') return t('flow.charVariant', { ch: c.ch, lyric })
  if (c.src === 'attached') return t('flow.charAttached', { ch: c.ch })
  return t('flow.charPlain', { ch: c.ch, style: styleLabel(c.st) })
}
function noteTitle(sym) {
  const orn = [...(sym.o || '')].map((o) => (ORN_LABEL[o] ? termShort(ORN_LABEL[o]) : o)).join('·')
  return [sym.raw, orn, sym.q ? termShort('气口') : ''].filter(Boolean).join(' ')
}

const rows = computed(() => model.lines.map((p, i) => {
  const next = model.lines[i + 1]
  const L = layoutPhrase(p, { maxWidth: avail.value, tailEnd: next ? next.s : null })
  const X = (t) => timeToX(L, t)
  const lyricOf = new Map(p.variants.map((v) => [v.i, v.lyric]))
  const charSeg = L.segments.filter((g) => g.kind === 'char')
  const block = (b) => ({ ...b, ...spanX(L, b.cs, b.ce, BLOCK_MIN), color: colorOf(b.t) })
  // 腔格名随界面语言显示；动作名始终是中文
  const term = (b) => ({ ...block(b), label: termShort(b.t), title: termFull(b.t) })
  const head = sectionLabel.value.get(i)
  const point = (q) => ({ ...q, x: X(q.t) })
  const notes = p.chars.flatMap((c) => c.gc.map((sym) => {
    const glyphs = toRenderNotes([sym])
    // 字形实际要占的宽度（估计）：主音/腔格各一格，板眼各半格
    const need = glyphs.reduce((w, g) => w + (sym.p ? 11 : 14) + g.beats.length * 7, 2)
    return { s: sym.s, side: !!sym.p, title: noteTitle(sym), glyphs, need, ...spanX(L, sym.s, sym.e) }
  }))
  const noteLines = packLines(notes)   // 长腔里挤在一起的音错开到下一排
  return {
    p, i, L, notes, noteLines,
    label: head?.label ?? '',
    labelTip: head?.labelTip || undefined,
    chars: p.chars.map((c, ci) => ({
      ci, ch: c.ch, s: c.s, src: c.src, nb: c.st === '念白式',
      x: charSeg[ci].x0, w: charSeg[ci].x1 - charSeg[ci].x0,
      title: charTitle(c, lyricOf.get(c.i)),
    })),
    qiangge: p.qiangge.map(term),
    // 来自临时腔格轨
    qpoints: p.points.filter((q) => q.provisional).map((q) => ({ ...point(q), title: t('flow.provisional', { label: termFull(q.l) }) })),
    actions: p.actions.map(block),
    apoints: p.points.filter((q) => !q.provisional).map(point),
    breaths: p.breaths.map(point),
    // 被排除的字：原来占的时间显示为空白
    gone: model.excluded
      .filter((g) => g.s >= p.s && (!next || g.s < next.s))
      .map((g) => ({
        ...g, ...spanX(L, g.s, g.e, BLOCK_MIN),
        title: t('flow.excluded', {
          ch: g.ch, from: fmt(g.s), to: fmt(g.e), reason: lang.value === 'zh' ? g.reason : g.reason_en ?? g.reason,
        }),
      })),
  }
}))

// —— 播放头 / 高亮：命令式 ——
const rowEls = []
const headEls = []
let shownHead = null
let onRow = null
let onChar = null

function moveHead(t) {
  const i = activeLineIdx.value
  const el = i >= 0 ? headEls[i] ?? null : null
  if (shownHead && shownHead !== el) shownHead.hidden = true
  if (el) {
    el.hidden = false
    el.style.transform = `translateX(${timeToX(rows.value[i].L, t)}px)`
  }
  shownHead = el
}

function markActive() {
  const rowEl = rowEls[activeLineIdx.value] ?? null
  if (rowEl !== onRow) {
    onRow?.classList.remove('on')
    onRow = rowEl
    rowEl?.scrollIntoView({ block: 'nearest' })
  }
  rowEl?.classList.add('on')
  const ci = activeCharIdx.value
  const chEl = rowEl && ci >= 0 ? rowEl.querySelector(`.ch[data-c="${ci}"]`) : null
  if (chEl !== onChar) { onChar?.classList.remove('on'); onChar = chEl }
  chEl?.classList.add('on')
}

watch([activeLineIdx, activeCharIdx], markActive, { flush: 'post' })
onUpdated(() => { markActive(); moveHead(clock.getTime()) })   // 开关 / 改宽度重渲染后补回

let unsub = null
onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure)
    observer.observe(scrollEl.value)
  }
  markActive()
  unsub = clock.onFrame(moveHead)
})
onUnmounted(() => { unsub?.(); observer?.disconnect() })
</script>

<template>
  <div class="flow">
    <div class="flow-hd">
      <h3>{{ t('flow.title') }}</h3>
      <span class="hint">{{ t('flow.hint') }}</span>
      <div class="tgs">
        <label v-for="tk in TRACKS" :key="tk.key" class="tg">
          <input type="checkbox" :data-track="tk.key" v-model="show[tk.key]" />{{ t(`track.${tk.key}`) }}
        </label>
      </div>
    </div>

    <div class="flow-scroll" ref="scrollEl">
      <div
        v-for="r in rows" :key="r.p.id" class="row" :class="r.p.status" :data-i="r.i"
        :ref="(el) => { rowEls[r.i] = el }">
        <div class="row-lb" :style="{ width: GUTTER + 'px' }">
          <span class="row-nm" :class="{ bai: r.p.kind === '白' }" :title="r.labelTip">{{ r.label }}</span>
          <span class="row-t">{{ fmt(r.p.s) }}</span>
        </div>

        <div
          class="row-body"
          :style="{ width: r.L.width + 'px', transform: r.L.scale < 1 ? `scaleX(${r.L.scale})` : undefined }">
          <!-- 唱词 -->
          <div class="lane ly">
            <button
              v-for="c in r.chars" :key="c.ci" class="ch" :class="[c.src, { nb: c.nb }]" :data-c="c.ci"
              :style="{ left: c.x + 'px', width: c.w + 'px' }" :title="c.title"
              @click="clock.seek(c.s)">{{ c.ch }}</button>
            <span
              v-for="g in r.gone" :key="'x' + g.s" class="gone"
              :style="{ left: g.x + 'px', width: g.w + 'px' }"
              :title="g.title"></span>
          </div>

          <!-- 工尺 -->
          <div
            v-if="show.gongche && r.notes.length" class="lane gc gongche-reader-redmark"
            :style="{ height: r.noteLines * NOTE_H + 5 + 'px' }">
            <button
              v-for="(n, ni) in r.notes" :key="ni" class="nt" :class="{ side: n.side }"
              :style="{ left: n.x + 'px', width: n.w + 'px', top: 2 + n.line * NOTE_H + 'px' }" :title="n.title"
              @click="clock.seek(n.s)">
              <span v-for="(g, gi) in n.glyphs" :key="gi" class="gl">
                <i v-if="g.qikou" class="gcn-symbol gcn-s-qikou" aria-hidden="true" />
                <i v-if="g.noteClass" :class="['gcn-symbol', g.noteClass]" aria-hidden="true" />
                <span v-else>{{ g.text }}</span>
                <i v-for="(d, di) in g.beats" :key="di" :class="['gcn-symbol', 'bt', beatClass(d)]" aria-hidden="true" />
              </span>
            </button>
          </div>

          <!-- 腔格 -->
          <div v-if="show.qiangge && (r.qiangge.length || r.qpoints.length)" class="lane qg">
            <button
              v-for="(b, bi) in r.qiangge" :key="bi" class="blk qg-b" :class="{ cp: b.cont_prev, cn: b.cont_next }"
              :style="{ left: b.x + 'px', width: b.w + 'px', background: b.color }" :title="b.title"
              @click="clock.seek(b.s)">{{ b.label }}</button>
            <button
              v-for="(q, qi) in r.qpoints" :key="'p' + qi" class="pt provisional"
              :style="{ left: q.x + 'px' }" :title="q.title" @click="clock.seek(q.t)"></button>
          </div>

          <!-- 呼吸 -->
          <div v-if="show.breath && r.breaths.length" class="lane br">
            <button
              v-for="(q, qi) in r.breaths" :key="qi" class="bp"
              :style="{ left: q.x + 'px' }" :title="t('flow.breathAt', { time: fmt(q.t) })" @click="clock.seek(q.t)"></button>
          </div>

          <!-- 动作 -->
          <div v-if="show.action && (r.actions.length || r.apoints.length)" class="lane ac">
            <button
              v-for="(b, bi) in r.actions" :key="bi" class="blk ac-b"
              :class="{ cp: b.cont_prev, cn: b.cont_next, provisional: b.provisional }"
              :style="{ left: b.x + 'px', width: b.w + 'px', background: b.color }"
              :title="b.provisional ? t('flow.provisional', { label: b.t }) : b.t"
              @click="clock.seek(b.s)">{{ b.t }}</button>
            <button
              v-for="(q, qi) in r.apoints" :key="'p' + qi" class="pt"
              :style="{ left: q.x + 'px' }" :title="q.l" @click="clock.seek(q.t)"></button>
          </div>

          <i class="ph" hidden :ref="(el) => { headEls[r.i] = el }"></i>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; }
.flow-hd { display: flex; align-items: center; gap: 12px; padding: 2px 2px 6px; }
.flow-hd h3 { margin: 0; font-size: 13.5px; letter-spacing: .1em; color: var(--ink-soft); font-weight: 600; }
.hint { font-size: 11px; color: var(--dai); }
.tgs { margin-left: auto; display: flex; gap: 10px; }
.tg { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; color: var(--ink-soft); cursor: pointer; }
.tg input { accent-color: var(--zhu); margin: 0; }

.flow-scroll { overflow: auto; border: 1px solid var(--line); border-radius: 8px; background: #fcf9f2; padding: 4px 0 10px; }

.row { display: flex; align-items: flex-start; padding: 5px 0 4px; border-left: 3px solid transparent; }
.row + .row { border-top: 1px solid var(--line-2); }
.row.on { background: rgba(178, 58, 46, .05); border-left-color: var(--zhu); }
/* 推定的分句：与左栏一致，虚线 + 淡色 */
.row.inferred { border-left: 3px dashed var(--line); }
.row.inferred.on { border-left: 3px dashed var(--zhu); }

.row-lb { flex: 0 0 auto; display: flex; flex-direction: column; gap: 1px; padding: 5px 6px 0 8px; }
.row-nm { font-size: 11.5px; letter-spacing: .04em; color: var(--ink); white-space: nowrap; min-height: 1em; }
.row-nm.bai { color: var(--dai); }
.row-t { font-family: var(--num); font-size: 10px; color: var(--dai); }

.row-body { position: relative; flex: 0 0 auto; transform-origin: 0 0; }
.lane { position: relative; }
.lane.ly { height: 30px; }
.lane.qg, .lane.ac { height: 18px; margin-top: 2px; }
.lane.br { height: 9px; margin-top: 1px; }

button { font: inherit; border: none; padding: 0; margin: 0; }

/* 唱词 */
.ch {
  position: absolute; top: 0; height: 30px; text-align: left; padding-left: 4px;
  font-size: 20px; line-height: 28px; color: var(--ink);
  background: #efe7d6; border-right: 1px solid #fcf9f2; border-radius: 3px;
}
.ch:hover { background: #e9dfc9; }
.ch.nb { background: #e9e9e3; color: #7a766c; }
.ch.variant { text-decoration: underline; text-decoration-color: var(--qing); text-decoration-thickness: 2px; text-underline-offset: 4px; }
.ch.attached { text-decoration: underline dotted; text-decoration-color: var(--dai); text-underline-offset: 4px; }
.row.inferred .ch { background: #f1ece0; color: var(--ink-soft); font-style: italic; }
.ch.on { background: #f6e3df; color: var(--zhu); box-shadow: inset 0 0 0 1.5px var(--zhu); }
.gone {
  position: absolute; top: 2px; height: 26px; border-radius: 3px; border: 1px dashed var(--line);
  background: repeating-linear-gradient(135deg, transparent 0 5px, #0000000d 5px 6px);
}

/* 工尺 */
.nt {
  position: absolute; height: 17px; min-width: 12px; background: none; white-space: nowrap; overflow: visible;
  text-align: left; color: #22252b; border-bottom: 2px solid #cfc4ab; display: flex; align-items: flex-start;
}
.nt:hover { border-bottom-color: var(--zhu); }
.nt.side { opacity: .75; }
.gl { display: inline-flex; align-items: flex-start; font-size: 12px; }
.nt :deep(.gcn-symbol) { display: inline-block; font-size: 14px; }
.nt.side :deep(.gcn-symbol) { font-size: 11px; }
.nt :deep(.gcn-symbol.bt) { font-size: 9px; }

/* 腔格 / 动作块 */
.blk {
  position: absolute; top: 0; bottom: 0; border-radius: 3px; font-size: 11px; line-height: 17px; padding: 0 4px;
  overflow: hidden; white-space: nowrap; text-align: left; color: #241f17; border: 1px solid #0001;
}
.blk:hover { filter: brightness(1.05); outline: 1px solid var(--zhu); }
.blk.cp { border-top-left-radius: 0; border-bottom-left-radius: 0; border-left: 2px dashed #0005; }
.blk.cn { border-top-right-radius: 0; border-bottom-right-radius: 0; border-right: 2px dashed #0005; }
.blk.provisional { opacity: .5; border-style: dashed; }

/* 点 */
.pt, .bp { position: absolute; top: 50%; width: 9px; height: 9px; border-radius: 50%; transform: translate(-50%, -50%); border: 1px solid #fff; }
.pt { background: var(--zhu); }
.pt.provisional { opacity: .5; }
.bp { background: var(--qing); width: 7px; height: 7px; }
.pt:hover, .bp:hover { transform: translate(-50%, -50%) scale(1.5); }

/* 播放头 */
.ph { position: absolute; left: 0; top: -2px; bottom: -2px; width: 2px; background: var(--zhu); pointer-events: none; z-index: 3; box-shadow: 0 0 6px rgba(178, 58, 46, .5); }
.ph[hidden] { display: none; }
</style>
