import { evidence } from '../evidence.js'
import { stableId } from '../ids.js'
import { diagnostic } from '../diagnostics.js'
import { fromNumber as rational, valueOf as numeric } from '../rational.js'

function field(fieldValue) {
  return fieldValue && typeof fieldValue === 'object' && 'value' in fieldValue
    ? fieldValue
    : { value: fieldValue, status: fieldValue ? 'inferred' : 'unresolved', evidenceIds: [] }
}

function allocateBinary(events, total) {
  if (events.length === 0) return []
  if (events.length === 1) return [total]
  const sameLyric = events.every((event) => event.sourceRef?.lineId === events[0].sourceRef?.lineId && event.sourceRef?.charIndex === events[0].sourceRef?.charIndex)
  const sideCount = events.filter((event) => event.sideNote).length
  if (sameLyric && sideCount > 0 && events.length <= 3) {
    if (events.length === 2) return events.map((event) => total * (event.sideNote ? 0.25 : 0.75))
    const mainCount = events.length - sideCount
    if (mainCount === 1 && sideCount === 2) return events.map((event) => total * (event.sideNote ? 0.25 : 0.5))
  }
  const weights = events.map((event) => event.sideNote ? 0.5 : event.realizationRole === 'rest' ? 0.5 : 1)
  const half = weights.reduce((sum, value) => sum + value, 0) / 2
  let prefix = 0
  let split = 1
  let best = Infinity
  for (let index = 1; index < weights.length; index += 1) {
    prefix += weights[index - 1]
    const distance = Math.abs(prefix - half)
    if (distance < best) { best = distance; split = index }
  }
  return [
    ...allocateBinary(events.slice(0, split), total / 2),
    ...allocateBinary(events.slice(split), total / 2),
  ]
}

function allocateMinimal(events, total) {
  if (events.length === 0) return []
  // Equal positive rationals are the unique first-choice solution under the
  // fallback objective: zero unequal divisions before considering notation cost.
  return events.map(() => total / events.length)
}

function unwrapAnchors(events, positions, capacity, diagnostics) {
  const anchors = []
  let lastPosition = -Infinity
  for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex]
    if (!event.anchors?.length) continue
    const occurrences = []
    for (const anchor of event.anchors) {
      const local = positions[anchor.code]
      if (local == null) {
        diagnostics.push(diagnostic('BANYAN_CYCLE_CONFLICT', 'error', `板式不接受板眼码 ${anchor.code}`, { sourceRef: anchor.sourceRef, eventIds: [event.id] }))
        return null
      }
      let absolute = local
      const mustBeAfter = occurrences.length > 0 || anchors.length > 0
      while (absolute < lastPosition || mustBeAfter && absolute === lastPosition) absolute += capacity
      occurrences.push(absolute)
      lastPosition = absolute
    }
    anchors.push({ eventIndex, start: occurrences[0], end: occurrences.at(-1) })
  }
  return anchors
}

function addMetricGapRests(section, timed, diagnostics) {
  const rests = []
  for (const [gapIndex, gap] of (section.metricGaps || []).entries()) {
    const onsetValue = gap.onset?.value || gap.onset
    const durationValue = gap.duration?.value || gap.duration
    if (!onsetValue || !durationValue) continue
    const onset = onsetValue.numerator / onsetValue.denominator
    const duration = durationValue.numerator / durationValue.denominator
    for (const event of timed) {
      const start = numeric(event.onset)
      const end = start + numeric(event.duration)
      if (start < onset && end > onset) {
        event.duration = evidence(rational(onset - start), 'inferred', 'confirmed-meter-gap-rest-v1')
        event.colorRole = 'inferred'
      }
    }
    const id = stableId('rest', section.id, 'metric-gap', gapIndex)
    rests.push({
      id, kind: 'rest', sourceEventIds: gap.sourceEventIds || [], sourceRef: gap.sourceRef || null,
      restOrigin: 'metric-gap', onset: evidence(rational(onset), 'inferred', 'confirmed-meter-gap-rest-v1'),
      duration: evidence(rational(duration), 'inferred', 'confirmed-meter-gap-rest-v1'), colorRole: 'inferred',
      restEvidence: evidence({ origin: 'metric-gap' }, 'inferred', 'confirmed-meter-gap-rest-v1'),
    })
    diagnostics.push(diagnostic('REST_INFERRED', 'warning', '由确认拍格和已审阅度量空缺推定休止', { eventIds: [id] }))
  }
  return rests
}

export function splitTiedEvents(rhythm) {
  if (rhythm.meter.value.senzaMisura) return rhythm
  const capacity = rhythm.meter.value.beats * 4 / rhythm.meter.value.beatType
  const split = []
  for (const event of rhythm.events) {
    let onset = numeric(event.onset)
    let remaining = numeric(event.duration)
    let segment = 0
    while (remaining > 1e-9) {
      const measureIndex = Math.floor((onset + 1e-9) / capacity)
      const boundary = (measureIndex + 1) * capacity
      const duration = Math.min(remaining, boundary - onset)
      const clone = segment === 0 ? event : {
        ...structuredClone(event),
        id: stableId(event.id, 'tie', segment),
        sourceEventIds: [...new Set([...(event.sourceEventIds || []), event.id])],
        lyric: null,
        lyricEvidence: null,
      }
      clone.onset = { ...event.onset, value: rational(onset) }
      clone.duration = { ...event.duration, value: rational(duration) }
      clone.measureIndex = measureIndex
      if (event.kind === 'note' && (segment > 0 || remaining > duration)) {
        clone.tie = { stop: segment > 0, start: remaining > duration }
      }
      split.push(clone)
      onset += duration
      remaining -= duration
      segment += 1
    }
  }
  rhythm.events = split.sort((left, right) => numeric(left.onset) - numeric(right.onset) || left.id.localeCompare(right.id))
  const maxEnd = rhythm.events.reduce((maximum, event) => Math.max(maximum, numeric(event.onset) + numeric(event.duration)), 0)
  rhythm.measures = Array.from({ length: Math.max(1, Math.ceil(maxEnd / capacity)) }, (_, index) => ({
    number: index + 1, duration: rational(capacity),
    durationEvidence: evidence(rational(capacity), rhythm.meter.status, rhythm.meter.ruleId || 'meter-measure-duration-v1', rhythm.meter.evidenceIds, rhythm.meter.note),
  }))
  return rhythm
}

export function inferMetricGapRests(section, rhythm, diagnostics) {
  if (rhythm.meter.value.senzaMisura || field(section.banshi).status !== 'confirmed') return rhythm
  const capacity = rhythm.meter.value.beats * 4 / rhythm.meter.value.beatType
  const sounding = [...rhythm.events].sort((left, right) => numeric(left.onset) - numeric(right.onset))
  const rests = []
  let cursor = 0
  for (const event of sounding) {
    const onset = numeric(event.onset)
    const establishesMetricBoundary = event.anchors?.length > 0 || event.restOrigin === 'metric-gap'
    if (onset > cursor + 1e-9 && establishesMetricBoundary) {
      const gapOnset = rational(cursor)
      const gapDuration = rational(onset - cursor)
      const id = stableId('rest', section.id, 'structural-gap', `${gapOnset.numerator}-${gapOnset.denominator}`, `${gapDuration.numerator}-${gapDuration.denominator}`)
      rests.push({
        id, kind: 'rest', sourceEventIds: [], sourceRef: event.sourceRef || null,
        restOrigin: 'metric-gap', onset: evidence(gapOnset, 'inferred', 'confirmed-meter-gap-rest-v1'),
        duration: evidence(gapDuration, 'inferred', 'confirmed-meter-gap-rest-v1'),
        restEvidence: evidence({ origin: 'metric-gap' }, 'inferred', 'confirmed-meter-gap-rest-v1'),
        colorRole: 'inferred', measureIndex: Math.floor(cursor / capacity),
      })
      diagnostics.push(diagnostic('REST_INFERRED', 'warning', '由确认拍格中的未占用时段推定休止', { eventIds: [id] }))
    }
    cursor = Math.max(cursor, onset + numeric(event.duration))
  }
  rhythm.events.push(...rests)
  return rhythm
}

export function resolveRhythm(section, events, profile, diagnostics) {
  const banshi = field(section.banshi || 'sanban')
  const meterValue = profile.banshiMeters[banshi.value] || profile.banshiMeters.sanban
  const meterStatus = banshi.status === 'confirmed' ? 'derived' : 'inferred'
  const meter = evidence(meterValue, meterStatus, 'default-banshi-meter-v1', banshi.evidenceIds || [])

  if (meterValue.senzaMisura) {
    const timed = events.map((event, index) => ({
      ...event, onset: evidence(rational(index), 'inferred', 'sanban-engraving-duration-v1'),
      duration: evidence(rational(1), 'inferred', 'sanban-engraving-duration-v1'), measureIndex: 0, colorRole: 'inferred',
    }))
    const duration = rational(events.length)
    return { meter, events: timed, measures: [{
      number: 1, duration, senzaMisura: true,
      durationEvidence: evidence(duration, 'inferred', 'sanban-engraving-duration-v1'),
    }] }
  }

  const capacity = meterValue.beats * 4 / meterValue.beatType
  const positions = profile.anchorPositions[banshi.value] || {}
  const anchorGroups = unwrapAnchors(events, positions, capacity, diagnostics)
  const anchorsAreComplete = anchorGroups?.length > 0 && anchorGroups[0].eventIndex === 0 &&
    (anchorGroups.length > 1 || anchorGroups[0].end > anchorGroups[0].start) &&
    anchorGroups.every((group, index) => index === 0 || group.start > anchorGroups[index - 1].start)
  const derived = banshi.status === 'confirmed' && anchorsAreComplete
  const usesGeneralRule = anchorsAreComplete
  const status = derived ? 'derived' : 'inferred'
  const ruleId = usesGeneralRule ? 'kunqu-gcn-rhythm-v1' : 'minimal-rhythm-quantization-v1'
  const onsets = new Array(events.length)
  const durations = new Array(events.length)

  if (anchorGroups?.length > 0) {
    const first = anchorGroups[0]
    for (let index = 0; index < first.eventIndex; index += 1) {
      onsets[index] = Math.max(0, first.start - (first.eventIndex - index) * 0.25)
      durations[index] = 0.25
    }
    for (let groupIndex = 0; groupIndex < anchorGroups.length; groupIndex += 1) {
      const group = anchorGroups[groupIndex]
      const next = anchorGroups[groupIndex + 1]
      const endIndex = next ? next.eventIndex : events.length
      let total = next ? next.start - group.start : Math.max(group.end - group.start, (Math.floor(group.start / capacity) + 1) * capacity - group.start)
      if (!(total > 0)) total = 1
      const window = events.slice(group.eventIndex, endIndex)
      const allocated = usesGeneralRule ? allocateBinary(window, total) : allocateMinimal(window, total)
      let cursor = group.start
      for (let offset = 0; offset < window.length; offset += 1) {
        onsets[group.eventIndex + offset] = cursor
        durations[group.eventIndex + offset] = allocated[offset]
        cursor += allocated[offset]
      }
    }
  } else {
    diagnostics.push(diagnostic('RHYTHM_INFERRED', 'warning', '缺少唯一可用的板眼窗口，采用最简量化'))
    for (let index = 0; index < events.length; index += 1) { onsets[index] = index; durations[index] = 1 }
  }

  if (anchorGroups?.length > 0 && !derived) {
    diagnostics.push(diagnostic('RHYTHM_INFERRED', 'warning', '板眼前提未完整确认，通用分配结果保留为推定'))
  }

  const timed = events.map((event, index) => ({
    ...event,
    onset: evidence(rational(onsets[index]), status, ruleId),
    duration: evidence(rational(durations[index]), status, ruleId),
    measureIndex: Math.floor(onsets[index] / capacity),
    colorRole: event.absolutePitch?.status === 'inferred' || status === 'inferred' ? 'inferred' : 'normal',
  }))
  timed.push(...addMetricGapRests(section, timed, diagnostics))
  const maxEnd = timed.reduce((maximum, event) => Math.max(maximum, numeric(event.onset) + numeric(event.duration)), capacity)
  const measures = Array.from({ length: Math.max(1, Math.ceil(maxEnd / capacity)) }, (_, index) => ({
    number: index + 1, duration: rational(capacity),
    durationEvidence: evidence(rational(capacity), meter.status, meter.ruleId || 'meter-measure-duration-v1', meter.evidenceIds, meter.note),
  }))
  return { meter, events: timed, measures }
}
