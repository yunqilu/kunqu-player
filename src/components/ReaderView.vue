<script setup>
import { computed, ref, watch } from 'vue'
import { model } from '../lib/model'
import { clock } from '../composables/useClock'
import { toRenderNotes, beatClass, markAdjacentDieqiang } from '../lib/gongche'
import { t } from '../i18n'
import { isMovementTrack, termFull, termShort } from '../i18n/terms'

const { activeLineIdx, activeCharIdx, activeSymIdx, activeAttrs, breathPulse } = clock

const prevText = computed(() => activeLineIdx.value > 0 ? model.lines[activeLineIdx.value - 1].text : '')
const nextText = computed(() => {
  const i = activeLineIdx.value
  return i >= 0 && i < model.lines.length - 1 ? model.lines[i + 1].text : ''
})

// 当前句渲染模型：每个字的工尺符号 → Xiqu 风格的平面 notes 数组
const curLine = computed(() => {
  const i = activeLineIdx.value
  if (i < 0) return null
  const l = model.lines[i]
  return {
    ...l,
    chars: l.chars.map((c) => {
      const notes = toRenderNotes(c.gc || [])
      markAdjacentDieqiang(notes)
      return {
        ch: c.ch,
        nb: c.st === '念白式',
        notes,
      }
    }),
  }
})

// 瞬时呼吸提示
const breathing = ref(false)
let bt = null
watch(breathPulse, () => {
  breathing.value = true
  clearTimeout(bt); bt = setTimeout(() => (breathing.value = false), 650)
})

// 此刻的腔格随界面语言显示；动作名始终是中文
const attrLabel = (a) => (isMovementTrack(a.track) ? a.type : termShort(a.type))
const attrTitle = (a) => (isMovementTrack(a.track) ? a.type : termFull(a.type))
</script>

<template>
  <div class="reader">
    <!-- 顶栏：前句提示 + 此刻腔格/气口 -->
    <div class="topbar">
      <span class="ctx prev" :title="prevText">{{ prevText }}</span>
      <span class="spacer"></span>
      <div class="nowbar">
        <transition-group name="pop">
          <span v-for="a in activeAttrs" :key="a.track + a.type" class="attr" :style="{ '--c': a.color }" :title="attrTitle(a)">
            {{ attrLabel(a) }}
          </span>
        </transition-group>
        <span class="breath" :class="{ on: breathing }">{{ t('reader.breath') }}</span>
      </div>
    </div>

    <!-- 主阅读区：竖排、从右到左 -->
    <div class="cur">
      <template v-if="curLine">
        <span
          v-for="(c, ci) in curLine.chars" :key="ci"
          class="word" :class="{ active: ci === activeCharIdx, nianbai: c.nb }">
          <span class="lyric">{{ c.ch }}</span>
          <span v-if="c.nb" class="bai">{{ t('reader.spoken') }}</span>
          <span v-else-if="c.notes.length" class="gongche-wrap">
            <span class="gongche-cell gongche-reader-redmark">
              <span
                class="gongche-notes"
                :class="{ 'gongche-notes-nonote': !c.notes.some((n) => n.noteClass && !n.noteClass.startsWith('gcn-s-qikou')) }">
                <span
                  v-for="(n, ni) in c.notes" :key="ni"
                  class="lyrics-note"
                  :class="{
                    'lyrics-side-note': n.side,
                    'adj-dieqiang': n.adjDieqiang,
                  }">
                  <i v-if="n.qikou" class="gcn-symbol gcn-s-qikou" aria-hidden="true" />
                  <i v-if="n.noteClass" :class="['gcn-symbol', n.noteClass]" aria-hidden="true" />
                  <span v-if="n.beats.length > 0" class="lyrics-beats">
                    <span>
                      <i
                        v-for="(d, di) in n.beats" :key="di"
                        :class="['gcn-symbol', beatClass(d)]"
                        aria-hidden="true"
                      />
                    </span>
                  </span>
                </span>
              </span>
            </span>
          </span>
        </span>
      </template>
      <span v-else class="prelude">{{ t('reader.prelude') }}</span>
    </div>

    <!-- 底栏：后句提示 -->
    <div class="botbar">
      <span class="ctx next" :title="nextText">{{ nextText }}</span>
    </div>
  </div>
</template>

<style scoped>
/* ── 整体：填满 stage 网格行高度，与视频等高，overflow 防止撑开 ── */
.reader {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  padding: 4px 6px;
  gap: 4px;
}

/* ── 顶栏 / 底栏 ── */
.topbar {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 22px;
  flex: 0 0 auto;
  overflow: hidden;
}
.botbar {
  display: flex;
  align-items: center;
  min-height: 20px;
  flex: 0 0 auto;
  overflow: hidden;
}
.spacer { flex: 1; }
.ctx {
  color: var(--dai);
  font-size: 14px;
  letter-spacing: .05em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: .55;
  max-width: 55%;
}

/* ── 此刻腔格/气口提示 ── */
.nowbar {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.attr {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 20px;
  background: var(--c);
  color: #1c1a16;
  border: 1px solid #0002;
}
.breath {
  font-size: 11px;
  color: var(--qing);
  opacity: .25;
  transition: opacity .15s, transform .15s;
  padding: 2px 8px;
  border: 1px dashed var(--qing);
  border-radius: 20px;
}
.breath.on { opacity: 1; transform: scale(1.06); }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: scale(.7); }
.pop-enter-active, .pop-leave-active { transition: all .18s; }

/* ═══════════════════════════════════════════════════════════════════════════
   主阅读区：竖排、从右到左
   flex-basis:0 + flex-grow:1 → 精确填充可用高度
   max-height:100% + overflow:hidden → 不超出，触发 flex-wrap 换列
   ═══════════════════════════════════════════════════════════════════════════ */
.cur {
  writing-mode: vertical-rl;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;    /* 列从右侧开始 */
  justify-content: flex-start;  /* 每列字从顶部开始 */
  flex: 1 1 0;
  min-height: 0;
  max-height: 100%;
  gap: 0 6px;
  padding: 6px 0;
  overflow: hidden;
}
.prelude {
  color: var(--dai);
  font-size: 20px;
}
/* 英文提示横排：竖排容器里的拉丁字母会整行侧躺 */
.prelude:lang(en) { writing-mode: horizontal-tb; font-size: 15px; }

/* ── 每个字：margin-right 预留工尺空间，工尺绝对定位不撑高 ── */
.word {
  writing-mode: vertical-rl;
  position: relative;
  display: inline-block;
  padding: 2px 2px;
  margin-right: 100px;          /* 每列预留工尺斜出空间 */
  border-radius: 4px;
  transition: background .2s;
  line-height: 1;
}
.word.active { background: rgba(178, 58, 46, .08); }

.lyric {
  font-family: KaiTi, "Kaiti SC", STKaiti, "楷体_GB2312", serif;
  font-size: clamp(28px, 5.6vh, 46px);
  line-height: 0.9;
  color: var(--ink);
  transition: color .2s;
}
.word.active .lyric { color: var(--zhu); }
.word.nianbai { opacity: .9; }
.word.nianbai .lyric { color: var(--dai); }

.bai {
  font-size: 9px;
  color: var(--dai);
}

/* ── 工尺谱：绝对定位挂字正右侧，不参与 flow，不撑高 ── */
.gongche-wrap {
  writing-mode: horizontal-tb;
  position: absolute;
  left: calc(100% + 2px);
  top: 40%;
}
.gongche-cell {
  display: inline-flex;
  align-items: flex-start;
}
/* opacity / active */
.gongche-notes .lyrics-note { opacity: .7; transition: opacity .15s; }
.word.active .gongche-notes .lyrics-note { opacity: .8; }
.gongche-notes .lyrics-note :deep(.gcn-symbol) {
  color: var(--ink-soft);
}

/* 板眼套红：传统工尺谱中特定板眼位用朱砂色（对齐 Xiqu-Annotation-System） */
.gongche-notes .lyrics-note :deep(.gcn-s-beat-1),
.gongche-notes .lyrics-note :deep(.gcn-s-beat-3),
.gongche-notes .lyrics-note :deep(.gcn-s-beat-4),
.gongche-notes .lyrics-note :deep(.gcn-s-beat-5),
.gongche-notes .lyrics-note :deep(.gcn-s-beat-7),
.gongche-notes .lyrics-note :deep(.gcn-s-beat-8) {
  color: #ff4c00;
}
.gongche-notes .lyrics-side-note { opacity: .5; }
</style>
