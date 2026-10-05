<script setup>
import { computed, ref, watch } from 'vue'
import { model } from '../lib/model'
import { clock } from '../composables/useClock'
import { t } from '../i18n'

// ── 视频正下方的英文字幕条 ───────────────────────────────────────────────────
//   不叠在画面上：央视的录像底部有烧录的中文字幕。
//   显示哪一句由时钟的 subtitleIdx 决定（见 lib/subtitle.js），它只在变化时才写入，
//   所以播放过程中这里每句最多重渲染一两次。
const { subtitleIdx } = clock

const current = computed(() => {
  const line = model.lines[subtitleIdx.value]
  return line?.en ? line : null
})
// 淡出的时候文字还要留着，所以另存最近显示过的一句
const shown = ref(null)
watch(current, (line) => { if (line) shown.value = line }, { immediate: true })
</script>

<template>
  <div class="subtitle" :class="{ on: !!current }">
    <span class="sub-text" lang="en" :title="shown?.en_note || undefined">{{ shown?.en }}</span>
    <span v-if="shown?.en_status === 'draft'" class="sub-draft" :title="t('subtitle.draftTip')">{{ t('subtitle.draft') }}</span>
  </div>
</template>

<style scoped>
.subtitle {
  display: flex; align-items: center; gap: 8px; height: 52px; padding: 0 12px;
  border: 1px solid var(--line-2); border-radius: 8px; background: var(--panel);
}
.sub-text, .sub-draft { opacity: 0; transition: opacity .15s; }
.subtitle.on .sub-text { opacity: 1; }
.subtitle.on .sub-draft { opacity: .75; }
.sub-text {
  flex: 1; min-width: 0; text-align: center; font-size: 15px; line-height: 22px; color: var(--ink);
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
}
.sub-draft {
  flex: 0 0 auto; font-size: 10px; line-height: 1; padding: 2px 4px; letter-spacing: .04em;
  color: var(--dai); border: 1px solid currentColor; border-radius: 3px;
}
</style>
