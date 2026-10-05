<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import LeftColumn from './components/LeftColumn.vue'
import ReaderView from './components/ReaderView.vue'
import Transport from './components/Transport.vue'
import Timeline from './components/Timeline.vue'
import PhraseFlow from './components/PhraseFlow.vue'
import ScoreReviewPanel from './components/ScoreReviewPanel.vue'
import { clock } from './composables/useClock'
import { model } from './lib/model'

const videoEl = ref(null)
const urlInput = ref('')
const showTimeline = ref(true)
const hasVideo = clock.hasVideo

function bindVideo() {
  const el = videoEl.value
  el.addEventListener('loadedmetadata', () => clock.attachVideo(el), { once: true })
}
function loadUrl() {
  const u = urlInput.value.trim()
  if (!u) return
  videoEl.value.src = u
  bindVideo()
}
function onFile(e) {
  const f = e.target.files[0]
  if (!f) return
  videoEl.value.src = URL.createObjectURL(f)
  bindVideo()
}

function onKey(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
  const i = clock.activeLineIdx.value
  if (e.code === 'Space') { e.preventDefault(); clock.togglePlay() }
  else if (e.code === 'ArrowLeft') clock.seek(clock.getTime() - (e.shiftKey ? 5 : 0.2))
  else if (e.code === 'ArrowRight') clock.seek(clock.getTime() + (e.shiftKey ? 5 : 0.2))
  else if (e.code === 'ArrowUp') { e.preventDefault(); if (i > 0) clock.seek(model.lines[i - 1].s) }
  else if (e.code === 'ArrowDown') { e.preventDefault(); if (i >= 0 && i < model.lines.length - 1) clock.seek(model.lines[i + 1].s) }
}

onMounted(() => { clock.start(); window.addEventListener('keydown', onKey) })
onUnmounted(() => { clock.stop(); window.removeEventListener('keydown', onKey) })
</script>

<template>
  <div class="app">
    <header class="hd">
      <span class="seal">寻夢</span>
      <div class="ttls">
        <div class="t1">{{ model.meta.title }}</div>
        <div class="t2">{{ model.meta.performer }}　{{ model.meta.source }}　声腔标注 · {{ model.lines.length }} 句</div>
      </div>
      <div class="spacer"></div>
      <div class="vsrc">
        <input v-model="urlInput" class="url" placeholder="视频直链 URL（https://…/寻梦.mp4）" @keyup.enter="loadUrl" />
        <button class="go" @click="loadUrl">载入</button>
        <label class="file">本地<input type="file" accept="video/*" @change="onFile" hidden /></label>
      </div>
    </header>

    <div class="body">
      <LeftColumn />
      <div class="main">
        <div class="stage">
          <div class="videowrap">
            <video ref="videoEl" playsinline></video>
            <div v-if="!hasVideo" class="novideo">
              <div class="play-ic">▶</div>
              <div>未载入视频 — 输入直链或选本地文件</div>
              <div class="sm">未载入时仍可按 ▶ / 空格 用「虚拟时间轴」预览同步</div>
            </div>
          </div>
          <ReaderView />
        </div>

        <Transport :show-timeline="showTimeline" @toggle-timeline="showTimeline = !showTimeline" />
        <PhraseFlow />
        <Timeline v-show="showTimeline" />
      </div>
    </div>
    <details class="review-drawer">
      <summary>五线谱审阅</summary>
      <ScoreReviewPanel />
    </details>
  </div>
</template>

<style scoped>
.hd { display: flex; align-items: center; gap: 12px; padding: 9px 16px; border-bottom: 1px solid var(--line); }
.seal { display: inline-grid; place-items: center; width: 38px; height: 38px; background: var(--zhu); color: #f7efe2;
  font-size: 17px; border-radius: 5px; letter-spacing: -2px; line-height: 1; box-shadow: inset 0 1px 0 #0003; flex: 0 0 auto; }
.ttls .t1 { font-size: 20px; letter-spacing: .06em; }
.ttls .t2 { font-size: 12px; color: var(--dai); letter-spacing: .1em; }
.spacer { flex: 1; }
.vsrc { display: flex; gap: 6px; align-items: center; }
.url { width: 280px; max-width: 38vw; font-family: inherit; font-size: 12.5px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 18px; background: #fff8; color: var(--ink); }
.url:focus { outline: none; border-color: var(--zhu); }
.go, .file { font-size: 12.5px; border: 1px solid var(--line); background: #fbf7ef; padding: 6px 12px; border-radius: 18px; color: var(--ink-soft); }
.go:hover, .file:hover { border-color: var(--zhu); color: var(--zhu); }
.file { cursor: pointer; }

.stage { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 16px; min-height: 0; height: 40vh; }
@media (max-width: 860px) { .stage { grid-template-columns: 1fr; } }
.videowrap { position: relative; aspect-ratio: 16/9; height: 100%; background: #15120d; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 28px -16px #0009; }
video { width: 100%; height: 100%; display: block; background: #15120d; object-fit: contain; }
.novideo { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; text-align: center; gap: 6px; color: #b9ad97; padding: 16px; }
.play-ic { font-size: 34px; opacity: .5; }
.novideo .sm { font-size: 11.5px; opacity: .7; }
.review-drawer { position: fixed; z-index: 30; right: 14px; bottom: 12px; width: min(820px, calc(100vw - 28px)); }
.review-drawer > summary { width: max-content; margin-left: auto; padding: 7px 14px; border: 1px solid var(--line); border-radius: 18px; background: var(--panel); box-shadow: 0 5px 18px #0002; cursor: pointer; list-style: none; }
.review-drawer[open] > summary { margin-bottom: 6px; }
</style>
