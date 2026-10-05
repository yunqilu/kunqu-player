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
import { probeVideo } from './lib/video'
import { lang, setLang, t } from './i18n'

const LANGS = [{ code: 'zh', label: '中' }, { code: 'en', label: 'EN' }]

const videoEl = ref(null)
const urlInput = ref('')
const showTimeline = ref(true)
const hasVideo = clock.hasVideo
// probing → loading → ready；探测不到是 missing，载入或解码失败是 failed
const videoState = ref('probing')
const showSource = ref(false)

function setSrc(src) {
  const el = videoEl.value
  videoState.value = 'loading'
  el.addEventListener('loadedmetadata', () => {
    clock.attachVideo(el)
    videoState.value = 'ready'
    showSource.value = false
  }, { once: true })
  el.src = src
}
function onVideoError() {
  if (!videoEl.value.getAttribute('src')) return
  videoState.value = 'failed'
  showSource.value = true
}
function loadUrl() {
  const u = urlInput.value.trim()
  if (!u) return
  setSrc(u)
}
function onFile(e) {
  const f = e.target.files[0]
  if (!f) return
  setSrc(URL.createObjectURL(f))
}
async function autoLoad() {
  const url = await probeVideo()
  if (videoState.value !== 'probing') return // 探测期间用户已经自己选了视频
  if (url) setSrc(url)
  else { videoState.value = 'missing'; showSource.value = true }
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

onMounted(() => { clock.start(); window.addEventListener('keydown', onKey); autoLoad() })
onUnmounted(() => { clock.stop(); window.removeEventListener('keydown', onKey) })
</script>

<template>
  <div class="app">
    <header class="hd">
      <span class="seal" role="img" :aria-label="t('header.seal')">寻夢</span>
      <div class="ttls">
        <div class="t1">{{ t('header.title') }}</div>
        <div class="t2">{{ t('header.subtitle', { performer: model.meta.performer, source: model.meta.source, n: model.lines.length }) }}</div>
      </div>
      <div class="spacer"></div>
      <button v-if="!showSource" class="go" @click="showSource = true">{{ t('header.changeVideo') }}</button>
      <div v-else class="vsrc">
        <input v-model="urlInput" class="url" :placeholder="t('header.urlPlaceholder')" @keyup.enter="loadUrl" />
        <button class="go" @click="loadUrl">{{ t('header.load') }}</button>
        <label class="file">{{ t('header.localFile') }}<input type="file" accept="video/*" @change="onFile" hidden /></label>
      </div>
      <div class="langs" role="group" :aria-label="t('header.language')">
        <button
          v-for="l in LANGS" :key="l.code" class="lang" :class="{ on: lang === l.code }"
          :data-lang="l.code" :aria-pressed="lang === l.code" @click="setLang(l.code)">{{ l.label }}</button>
      </div>
    </header>

    <div class="body">
      <LeftColumn />
      <div class="main">
        <div class="stage">
          <div class="videowrap">
            <video ref="videoEl" playsinline @error="onVideoError"></video>
            <div v-if="!hasVideo" class="novideo">
              <div class="play-ic">▶</div>
              <div v-if="videoState === 'probing' || videoState === 'loading'">{{ t('video.loading') }}</div>
              <template v-else>
                <div class="hint">{{ t(videoState === 'failed' ? 'video.failed' : 'video.missing') }}</div>
                <div class="sm">{{ t('video.virtual') }}</div>
              </template>
            </div>
            <div v-else-if="videoState === 'failed'" class="vfail">{{ t('video.failed') }}</div>
          </div>
          <ReaderView />
        </div>

        <Transport :show-timeline="showTimeline" @toggle-timeline="showTimeline = !showTimeline" />
        <PhraseFlow />
        <Timeline v-show="showTimeline" />
      </div>
    </div>
    <details class="review-drawer">
      <summary>{{ t('review.drawer') }}</summary>
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
.langs { display: flex; border: 1px solid var(--line); border-radius: 18px; overflow: hidden; flex: 0 0 auto; }
.lang { font-size: 12.5px; border: none; background: #fbf7ef; padding: 6px 11px; color: var(--ink-soft); }
.lang + .lang { border-left: 1px solid var(--line); }
.lang:hover { color: var(--zhu); }
.lang.on { background: var(--zhu); color: #f7efe2; }

.stage { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 16px; min-height: 0; height: 40vh; }
@media (max-width: 860px) { .stage { grid-template-columns: 1fr; } }
.videowrap { position: relative; aspect-ratio: 16/9; height: 100%; background: #15120d; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 28px -16px #0009; }
video { width: 100%; height: 100%; display: block; background: #15120d; object-fit: contain; }
.novideo { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; text-align: center; gap: 6px; color: #b9ad97; padding: 16px; }
.play-ic { font-size: 34px; opacity: .5; }
.novideo .sm { font-size: 11.5px; opacity: .7; }
.novideo .hint { max-width: 34em; font-size: 12.5px; line-height: 1.5; color: #e3d8c2; }
.vfail { position: absolute; left: 0; right: 0; top: 0; padding: 6px 12px; font-size: 12.5px; text-align: center; color: #e3d8c2; background: #15120dcc; }
.review-drawer { position: fixed; z-index: 30; right: 14px; bottom: 12px; width: min(820px, calc(100vw - 28px)); }
.review-drawer > summary { width: max-content; margin-left: auto; padding: 7px 14px; border: 1px solid var(--line); border-radius: 18px; background: var(--panel); box-shadow: 0 5px 18px #0002; cursor: pointer; list-style: none; }
.review-drawer[open] > summary { margin-bottom: 6px; }
</style>
