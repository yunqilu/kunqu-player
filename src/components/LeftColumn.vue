<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { playInfo } from '../data/meta'
import { t } from '../i18n'
import { model } from '../lib/model'
import { buildOutline } from '../lib/outline'
import { clock } from '../composables/useClock'

const railEl = ref(null)
const { activeLineIdx } = clock
const outline = computed(() => buildOutline(model))
const info = computed(playInfo)

const countText = (g) =>
  t(g.count === 1 ? 'left.phraseOne' : 'left.phraseMany', { n: g.count }) +
  (g.inferred ? t('left.inferredCount', { n: g.inferred }) : '')
const itemTitle = (x) =>
  [`${fmt(x.s)} ${x.text}`, x.en, t(`status.${x.status}`), x.tip].filter(Boolean).join('\n')

const fmt = (s) => { s = Math.max(0, s || 0); const m = (s / 60) | 0, x = (s % 60) | 0; return `${m}:${String(x).padStart(2, '0')}` }

// 当前句变化时，在「句轨」容器内部自动滚动到可见（不影响整页）
watch(activeLineIdx, async (i) => {
  if (i < 0) return
  await nextTick()
  const el = railEl.value?.querySelector(`[data-i="${i}"]`)
  if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})
</script>

<template>
  <aside class="left">
    <section class="intro">
      <h2 class="ttl">{{ info.title }}</h2>
      <div class="sub">{{ info.subtitle }}</div>
      <dl class="facts">
        <template v-for="f in info.fields" :key="f.k">
          <dt>{{ f.k }}</dt><dd>{{ f.v }}</dd>
        </template>
      </dl>
      <p class="syn">{{ info.synopsis }}</p>
    </section>

    <section class="rail-wrap">
      <div class="rail-hd">{{ t('left.outlineTitle') }}</div>
      <div class="rail" ref="railEl">
        <section v-for="g in outline" :key="g.key" class="sec">
          <h3 class="sec-hd">
            <span class="sec-nm" :class="{ bai: g.kind === '白' }" :title="g.labelTip || undefined">{{ g.label }}</span>
            <span class="sec-ct">{{ countText(g) }}</span>
          </h3>
          <button
            v-for="x in g.items" :key="x.id" :data-i="x.index"
            class="rail-item" :class="[x.status, { on: x.index === activeLineIdx }]"
            @click="clock.seek(x.s)"
            :title="itemTitle(x)">
            <span class="rt">{{ fmt(x.s) }}</span>
            <span class="rx">{{ x.text }}</span>
            <span v-if="x.status === 'variant'" class="mark">{{ t('left.variantMark') }}</span>
          </button>
        </section>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.left {
  border-right: 1px solid var(--line);
  background: linear-gradient(180deg, #f7f2e8, #f1eadc);
  display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0;
}
.intro { padding: 12px 14px 10px; border-bottom: 1px solid var(--line-2); overflow: auto; max-height: 44vh; }
.ttl { margin: 0; font-size: 20px; letter-spacing: .06em; color: var(--ink); }
.sub { font-size: 11.5px; color: var(--dai); letter-spacing: .04em; margin: 3px 0 8px; }
.facts { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; margin: 0 0 8px; font-size: 12.5px; }
.facts dt { color: var(--dai); white-space: nowrap; }
.facts dd { margin: 0; color: var(--ink-soft); }
.syn { font-size: 12.5px; line-height: 1.7; color: var(--ink-soft); margin: 0; text-align: justify; }

.rail-wrap { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; }
.rail-hd { font-size: 11px; color: var(--dai); letter-spacing: .12em; padding: 7px 14px 5px; }
.rail { overflow-y: auto; padding: 0 8px 10px; }
.rail-item {
  display: flex; gap: 8px; align-items: baseline; width: 100%; text-align: left;
  border: none; background: none; padding: 4px 8px; border-radius: 6px;
  color: var(--ink-soft); border-left: 2px solid transparent; transition: background .15s, color .15s;
}
.rail-item:hover { background: #00000008; }
.rail-item.on { background: rgba(178, 58, 46, .09); color: var(--zhu); border-left-color: var(--zhu); }
.rt { font-family: var(--num); font-size: 10.5px; color: var(--dai); min-width: 30px; }
.rail-item.on .rt { color: var(--zhu-soft); }
.rx { font-size: 14px; letter-spacing: .03em; }

.sec-hd {
  display: flex; justify-content: space-between; align-items: baseline; gap: 8px;
  margin: 10px 0 2px; padding: 3px 8px 3px 10px; font-weight: normal;
  border-bottom: 1px solid var(--line-2);
}
.sec:first-child .sec-hd { margin-top: 2px; }
.sec-nm { font-size: 13px; letter-spacing: .08em; color: var(--ink); }
.sec-nm.bai { color: var(--dai); }
.sec-ct { font-family: var(--num); font-size: 10.5px; color: var(--dai); white-space: nowrap; }

/* 推定的分句：虚线左边框 + 淡色，不与确定的分句混同 */
.rail-item.inferred { border-left: 2px dashed var(--line); border-radius: 0 6px 6px 0; }
.rail-item.inferred .rx { color: var(--dai); font-style: italic; }
.rail-item.inferred.on { border-left: 2px dashed var(--zhu); }
.rail-item.inferred.on .rx { color: var(--zhu); }

/* 与歌词有出入的分句 */
.mark {
  margin-left: auto; font-size: 10px; line-height: 1; padding: 2px 3px;
  color: var(--qing); border: 1px solid currentColor; border-radius: 3px; opacity: .8;
}
</style>
