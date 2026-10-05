<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import projection from '../data/viewerModel.json'
import manifest from '../data/reviews/xunmeng.review.json'
import { createScoreReviewState } from '../composables/useScoreReview'
import { t } from '../i18n'
import { qupaiName } from '../i18n/qupai'

const props = defineProps({ state: { type: Object, default: null } })
const review = props.state || createScoreReviewState({ projection, manifest })
const editField = ref('duration')
const editValue = ref('')
const editNote = ref('')

const selectedEvent = computed(() => review.selected.value?.event || null)
const selectedSection = computed(() => review.selected.value?.section || null)

const COUNTS = ['confirmed', 'derived', 'inferred', 'unresolved']
const STATUSES = ['all', ...COUNTS]
const FIELDS = ['all', 'relativePitch', 'absolutePitch', 'onset', 'duration']
const sectionName = (section) => qupaiName(section.qupai?.value || section.qupai || section.id)

function select(entry) {
  review.selectedId.value = entry.id
  if (entry.event) {
    const field = entry.event.duration?.status === 'inferred' ? 'duration' : entry.event.absolutePitch?.status === 'inferred' ? 'absolutePitch' : 'onset'
    editField.value = field
    editValue.value = JSON.stringify(entry.event[field]?.value ?? null)
  } else if (entry.section) {
    const field = entry.section.banshi?.status === 'inferred' ? 'banshi' : entry.section.dise?.status === 'inferred' ? 'dise' : 'shangPitch'
    editField.value = field
    editValue.value = JSON.stringify(field === 'shangPitch' ? entry.section.tuning?.value?.shangPitch : entry.section[field]?.value ?? entry.section[field] ?? null)
  }
}

function confirm() {
  if (!selectedEvent.value && !selectedSection.value) return
  let value
  try { value = JSON.parse(editValue.value) } catch { return }
  review.confirmField(selectedEvent.value?.id || selectedSection.value.id, editField.value, value, editNote.value)
}

function beforeUnload(event) {
  if (!review.dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}
async function importManifest(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try { review.loadManifest(await file.text()) } finally { event.target.value = '' }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <section class="score-review" :aria-label="t('review.title')">
    <header class="review-head">
      <strong>{{ t('review.title') }}</strong>
      <span v-for="kind in COUNTS" :key="kind" class="count" :class="kind">{{ t(`review.count.${kind}`, { n: review.counts.value[kind] }) }}</span>
      <span class="count">{{ t('review.count.diagnostics', { n: review.counts.value.diagnostics }) }}</span>
      <label class="playback-toggle"><input :checked="review.playbackEnabled.value" type="checkbox" @change="review.setPlaybackEnabled($event.target.checked)" /> {{ t('review.playback') }}</label>
    </header>

    <div class="review-tools">
      <select v-model="review.statusFilter.value" :aria-label="t('review.filter.status')">
        <option v-for="status in STATUSES" :key="status" :value="status">{{ t(`review.status.${status}`) }}</option>
      </select>
      <select v-model="review.severityFilter.value" :aria-label="t('review.filter.severity')">
        <option value="all">{{ t('review.severity.all') }}</option><option value="fatal">fatal</option><option value="error">error</option><option value="warning">warning</option>
      </select>
      <select v-model="review.sectionFilter.value" :aria-label="t('review.filter.section')">
        <option value="all">{{ t('review.section.all') }}</option>
        <option v-for="section in review.result.value.canonicalScore.sections" :key="section.id" :value="section.id">{{ sectionName(section) }}</option>
      </select>
      <select v-model="review.fieldFilter.value" :aria-label="t('review.filter.field')">
        <option v-for="field in FIELDS" :key="field" :value="field">{{ t(`review.field.${field}`) }}</option>
      </select>
      <input v-model="review.ruleFilter.value" :aria-label="t('review.filter.rule')" :placeholder="t('review.rulePlaceholder')" />
      <div class="downloads">
        <button v-for="kind in ['musicXml','reviewedSource','relativeScore','canonicalScore','playbackPlan','diagnostics','reviewManifest']" :key="kind" @click="review.download(kind)">{{ kind }}</button>
        <label class="import-button">{{ t('review.import') }}<input type="file" accept="application/json" :aria-label="t('review.importLabel')" @change="importManifest" /></label>
      </div>
    </div>

    <div class="review-grid">
      <ol class="review-list">
        <li v-for="entry in review.entries.value" :key="entry.id">
          <button :class="[entry.status, { active: review.selectedId.value === entry.id }]" @click="select(entry)">
            <template v-if="entry.event">{{ entry.event.lyric?.text || t('review.rest') }} · {{ entry.status }} · {{ entry.ruleIds.join(', ') }}</template>
            <template v-else-if="entry.section">{{ t('review.sectionEntry') }} · {{ sectionName(entry.section) }} · {{ entry.status }}</template>
            <template v-else>{{ entry.diagnostic.severity }} · {{ entry.diagnostic.code }}</template>
          </button>
        </li>
      </ol>
      <div class="review-detail">
        <template v-if="review.selected.value">
          <dl>
            <dt>ID</dt><dd>{{ review.selected.value.event?.id || review.selected.value.section?.id || review.selected.value.diagnostic?.code }}</dd>
            <dt>{{ t('review.detail.source') }}</dt><dd>{{ review.selectedSource.value?.raw || '—' }}</dd>
            <dt>{{ t('review.detail.position') }}</dt><dd><code>{{ JSON.stringify(review.selectedSource.value?.sourceRef || null) }}</code></dd>
            <dt>{{ t('review.detail.rules') }}</dt><dd>{{ review.selected.value.ruleIds?.join(', ') || review.selected.value.diagnostic?.suggestedAction || '—' }}</dd>
            <dt>{{ t('review.detail.evidence') }}</dt><dd><code>{{ JSON.stringify(review.selectedProvenance.value?.fields || null) }}</code></dd>
            <dt>{{ t('review.detail.note') }}</dt><dd>{{ selectedEvent?.absolutePitch?.note || selectedEvent?.onset?.note || selectedEvent?.duration?.note || '—' }}</dd>
          </dl>
          <div v-if="selectedEvent || selectedSection" class="editor">
            <select v-model="editField">
              <template v-if="selectedEvent"><option value="relativePitch">relativePitch</option><option value="absolutePitch">absolutePitch</option><option value="onset">onset</option><option value="duration">duration</option></template>
              <template v-else><option value="banshi">banshi</option><option value="dise">dise</option><option value="shangPitch">shangPitch</option></template>
            </select>
            <textarea v-model="editValue" :aria-label="t('review.edit.value')" />
            <input v-model="editNote" :aria-label="t('review.edit.note')" :placeholder="t('review.edit.note')" />
            <button @click="confirm">{{ t('review.edit.confirm') }}</button>
          </div>
        </template>
        <p v-else>{{ t('review.empty') }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.score-review { height: min(64vh, 620px); min-height: 360px; display: flex; flex-direction: column; background: #fbf7ef; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; box-shadow: 0 16px 44px #2b201b35; }
.review-head, .review-tools { display: flex; align-items: center; gap: 7px; padding: 8px 10px; border-bottom: 1px solid var(--line-2); }
.review-head strong { margin-right: 6px; }
.count { padding: 2px 6px; border-radius: 10px; background: #eee5d5; font-size: 11px; }
.count.inferred { color: #9a5200; }.count.unresolved { color: #a11; }.count.derived { color: #245c3c; }
.playback-toggle { margin-left: auto; font-size: 12px; }
.review-tools input, .review-tools select, .editor input, .editor select, .editor textarea { min-width: 0; border: 1px solid var(--line); border-radius: 4px; background: white; padding: 4px 6px; font: inherit; font-size: 11px; }
.review-tools > input { flex: 1; }.downloads { display: flex; gap: 3px; flex-wrap: wrap; justify-content: flex-end; }.downloads button, .editor button { font-size: 10px; padding: 3px 6px; }
.import-button { position: relative; overflow: hidden; border: 1px solid var(--line); border-radius: 4px; padding: 3px 6px; background: white; font-size: 10px; }.import-button input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.review-grid { display: grid; grid-template-columns: minmax(260px, 1fr) minmax(280px, 1fr); min-height: 0; flex: 1; }
.review-list { min-height: 0; overflow: auto; margin: 0; padding: 6px; list-style: none; border-right: 1px solid var(--line-2); }
.review-list button { width: 100%; text-align: left; border: 0; border-left: 4px solid transparent; background: transparent; padding: 5px 7px; color: var(--ink-soft); }
.review-list button.inferred { border-left-color: #D97706; }.review-list button.unresolved { border-left-color: #B91C1C; }.review-list button.active { background: #eee5d5; }
.review-detail { overflow: auto; padding: 10px; font-size: 12px; }.review-detail dl { display: grid; grid-template-columns: 45px 1fr; gap: 5px; }.review-detail dt { color: var(--dai); }.review-detail dd { margin: 0; overflow-wrap: anywhere; }
.editor { display: grid; gap: 6px; margin-top: 12px; }.editor textarea { min-height: 58px; resize: vertical; }
@media (max-width: 700px) { .review-grid { grid-template-columns: 1fr; }.review-detail { display: none; }.review-tools { flex-wrap: wrap; } }
</style>
