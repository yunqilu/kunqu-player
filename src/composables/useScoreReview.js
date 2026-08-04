import { computed, ref, shallowRef } from 'vue'

import defaultPlaybackProfile from '../data/profiles/gongchepu-playback-2020-v1.json'
import { downloadText } from '../lib/download'
import { stableId, stableStringify } from '../score/ids.js'
import { convertKunquScore } from '../score/pipeline.js'
import { validateArtifact } from '../score/schema/validate.js'

const plainCopy = (value) => JSON.parse(JSON.stringify(value))

function eventStatus(event) {
  const statuses = [event.relativePitch, event.absolutePitch, event.onset, event.duration]
    .filter(Boolean).map((field) => field.status)
  if (event.realizationStatus === 'unresolved' || statuses.includes('unresolved')) return 'unresolved'
  if (statuses.includes('inferred')) return 'inferred'
  if (statuses.includes('confirmed')) return 'confirmed'
  return 'derived'
}

function ruleIds(event) {
  return [...new Set([event.relativePitch, event.absolutePitch, event.onset, event.duration]
    .map((field) => field?.ruleId).filter(Boolean))]
}

export function createScoreReviewState({ projection, manifest, conversionProfile = null, playbackProfile = defaultPlaybackProfile }) {
  const reviewManifest = ref(plainCopy(manifest))
  const playbackEnabled = ref(true)
  const result = shallowRef(null)
  const selectedId = ref(null)
  const statusFilter = ref('all')
  const severityFilter = ref('all')
  const ruleFilter = ref('')
  const sectionFilter = ref('all')
  const fieldFilter = ref('all')
  const dirty = ref(false)

  function regenerate() {
    result.value = convertKunquScore({
      projection,
      reviewManifest: plainCopy(reviewManifest.value),
      conversionProfile,
      playbackProfile: playbackEnabled.value ? playbackProfile : null,
    })
  }
  regenerate()

  const scoreEntries = computed(() => result.value.canonicalScore.sections.flatMap((section) => section.events.map((event) => ({
    type: 'event', id: event.id, sectionId: section.id, status: eventStatus(event), ruleIds: ruleIds(event), event,
    inferredFields: ['relativePitch', 'absolutePitch', 'onset', 'duration'].filter((key) => event[key]?.status === 'inferred'),
  }))))
  const sectionEntries = computed(() => result.value.canonicalScore.sections.map((section) => {
    const fields = [section.qupai, section.banshi, section.dise, section.tuning].filter((field) => field && typeof field === 'object' && 'status' in field)
    const status = fields.some((field) => field.status === 'unresolved') ? 'unresolved'
      : fields.some((field) => field.status === 'inferred') ? 'inferred'
        : fields.some((field) => field.status === 'confirmed') ? 'confirmed' : 'derived'
    return {
      type: 'section', id: `section:${section.id}`, targetId: section.id, sectionId: section.id, status, section,
      ruleIds: [...new Set(fields.map((field) => field.ruleId).filter(Boolean))], inferredFields: ['banshi', 'dise', 'shangPitch'].filter((key) => section[key]?.status === 'inferred' || key === 'shangPitch' && section.tuning?.status === 'inferred'),
    }
  }))
  const diagnosticEntries = computed(() => result.value.diagnostics.map((item, index) => ({
    type: 'diagnostic', id: `diagnostic-${index}`, status: null, ruleIds: [], diagnostic: item,
  })))
  const counts = computed(() => {
    const values = { confirmed: 0, derived: 0, inferred: 0, unresolved: 0, diagnostics: diagnosticEntries.value.length }
    for (const entry of [...sectionEntries.value, ...scoreEntries.value]) values[entry.status] += 1
    return values
  })
  const entries = computed(() => [...sectionEntries.value, ...scoreEntries.value, ...diagnosticEntries.value].filter((entry) => {
    if (statusFilter.value !== 'all' && entry.status !== statusFilter.value) return false
    if (sectionFilter.value !== 'all' && entry.sectionId !== sectionFilter.value) return false
    if (fieldFilter.value !== 'all' && !entry.inferredFields?.includes(fieldFilter.value)) return false
    if (severityFilter.value !== 'all' && entry.diagnostic?.severity !== severityFilter.value) return false
    if (ruleFilter.value && !entry.ruleIds.some((rule) => rule.includes(ruleFilter.value)) && !entry.diagnostic?.code?.includes(ruleFilter.value)) return false
    return true
  }))
  const selected = computed(() => [...sectionEntries.value, ...scoreEntries.value, ...diagnosticEntries.value].find((entry) => entry.id === selectedId.value) || null)
  const selectedSource = computed(() => {
    const refValue = selected.value?.event?.sourceRef || selected.value?.diagnostic?.sourceRef
    if (!refValue) return null
    const line = result.value.reviewedSource.lines.find((candidate) => candidate.id === refValue.lineId)
    const char = line?.chars[refValue.charIndex]
    const symbol = char?.gc[refValue.gongcheIndex]
    return { lineId: refValue.lineId, charIndex: refValue.charIndex, lyric: char?.ch || null, raw: symbol?.raw || null, sourceRef: refValue }
  })
  const selectedProvenance = computed(() => {
    const id = selected.value?.event?.id
    return id ? result.value.relativeScore.provenanceIndex[id] || null : null
  })

  function confirmField(targetId, fieldPath, value, note = '') {
    const next = plainCopy(reviewManifest.value)
    const override = {
      id: stableId('override', targetId, fieldPath),
      targetId,
      fieldPath,
      value: structuredClone(value),
      status: 'confirmed',
      evidenceIds: [],
      note: note || 'Viewer 人工确认',
    }
    const index = next.overrides.findIndex((item) => item.targetId === targetId && item.fieldPath === fieldPath)
    if (index >= 0) next.overrides[index] = override
    else next.overrides.push(override)
    reviewManifest.value = next
    dirty.value = true
    regenerate()
  }

  function setPlaybackEnabled(value) {
    playbackEnabled.value = value
    regenerate()
  }

  function loadManifest(value) {
    const loaded = typeof value === 'string' ? JSON.parse(value) : plainCopy(value)
    const validation = validateArtifact('reviewManifest', loaded)
    if (!validation.valid) throw new Error(`Invalid review manifest: ${validation.errors.join('; ')}`)
    reviewManifest.value = loaded
    dirty.value = false
    selectedId.value = null
    regenerate()
  }

  function artifactText(kind) {
    if (kind === 'musicXml') return result.value.musicXml
    if (kind === 'reviewManifest') return `${stableStringify(reviewManifest.value)}\n`
    return `${stableStringify(result.value[kind])}\n`
  }

  function download(kind) {
    const files = {
      reviewedSource: 'reviewed-source.json', relativeScore: 'relative-score.json', canonicalScore: 'canonical-score.json',
      musicXml: 'score.musicxml', playbackPlan: 'playback-plan.json', diagnostics: 'diagnostics.json', reviewManifest: 'review-manifest.json',
    }
    downloadText(files[kind], artifactText(kind), kind === 'musicXml' ? 'application/vnd.recordare.musicxml+xml' : 'application/json')
    if (kind === 'reviewManifest') dirty.value = false
  }

  return {
    result, reviewManifest, playbackEnabled, selectedId, statusFilter, severityFilter, ruleFilter, sectionFilter, fieldFilter, dirty,
    scoreEntries, sectionEntries, diagnosticEntries, counts, entries, selected, selectedSource, selectedProvenance,
    regenerate, confirmField, setPlaybackEnabled, loadManifest, artifactText, download,
  }
}
