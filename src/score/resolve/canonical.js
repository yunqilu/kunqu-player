import defaultProfile from '../../data/profiles/kunqu-default-v1.json' with { type: 'json' }
import { diagnostic } from '../diagnostics.js'
import { applyQianggeTiming, realizeQiangge } from './qiangge.js'
import { inferMetricGapRests, resolveRhythm, splitTiedEvents } from './rhythm.js'
import { resolveTuning } from './tuning.js'
import { applyOverrides } from '../review/applyOverrides.js'
import { evidence } from '../evidence.js'
import { fromNumber, valueOf } from '../rational.js'

function reflowAfterTimingOverrides(section, timingOverrides, diagnostics) {
  if (timingOverrides.length === 0) return
  let cursor = 0
  section.events.sort((left, right) => valueOf(left.onset) - valueOf(right.onset) || left.id.localeCompare(right.id))
  for (const event of section.events) {
    let onset = valueOf(event.onset)
    const fixedOnset = event.onset.status === 'confirmed' || event.anchors?.length > 0 || event.restOrigin === 'metric-gap'
    if (onset < cursor - 1e-9 && !fixedOnset) {
      onset = cursor
      event.onset = evidence(fromNumber(onset), 'inferred', 'override-dependent-reflow-v1', [], '由人工时值覆盖重新排布')
      event.colorRole = 'inferred'
    } else if (onset < cursor - 1e-9) {
      diagnostics.push(diagnostic('OVERRIDE_METRIC_CONFLICT', 'error', '人工时值与确认拍位发生重叠，保留确认拍位并等待复核', {
        sourceRef: event.sourceRef, eventIds: [event.id], fieldPath: 'onset',
      }))
    }
    cursor = Math.max(cursor, onset + valueOf(event.duration))
  }
}

export function createCanonicalScore(relativeScore, diagnostics, conversionProfile = null, overrides = []) {
  const profile = conversionProfile || defaultProfile
  const appliedIds = new Set()
  const sections = relativeScore.sections.map((section) => {
    const workingSection = structuredClone(section)
    applyOverrides({ sections: [workingSection] }, overrides.filter((item) => item.targetId === section.id), diagnostics, { appliedIds })
    applyOverrides({ sections: [workingSection] }, overrides.filter((item) =>
      item.fieldPath === 'relativePitch' && workingSection.events.some((event) => event.id === item.targetId)), diagnostics, { appliedIds })
    const tuning = resolveTuning(workingSection, profile, diagnostics)
    const pitched = workingSection.events.map((event) => ({ ...event, absolutePitch: tuning.pitch(event.relativePitch.value) }))
    const realized = realizeQiangge(workingSection, pitched, diagnostics)
    for (const event of realized) {
      for (const qiangge of event.qiangge || []) {
        if (qiangge.code === 'h' || qiangge.code === 's') {
          diagnostics.push(diagnostic('QIANGGE_UNREALIZED', 'warning', `${qiangge.name}尚无审定微观展开`, { sourceRef: qiangge.sourceRef, eventIds: [event.id] }))
        }
      }
    }
    const rhythm = applyQianggeTiming(workingSection, resolveRhythm(workingSection, realized, profile, diagnostics), diagnostics)
    const canonicalSection = { ...workingSection, tuning: tuning.context, meter: rhythm.meter, measures: rhythm.measures, events: rhythm.events }
    const eventOverrides = overrides.filter((item) =>
      !appliedIds.has(item.id) && realized.some((event) => event.id === item.targetId))
    applyOverrides({ sections: [canonicalSection] }, eventOverrides, diagnostics, { appliedIds })
    reflowAfterTimingOverrides(canonicalSection, eventOverrides.filter((item) => item.fieldPath === 'onset' || item.fieldPath === 'duration'), diagnostics)
    inferMetricGapRests(workingSection, canonicalSection, diagnostics)
    const split = splitTiedEvents({ meter: canonicalSection.meter, events: canonicalSection.events, measures: canonicalSection.measures })
    canonicalSection.events = split.events
    canonicalSection.measures = split.measures
    applyOverrides({ sections: [canonicalSection] }, overrides.filter((item) => !appliedIds.has(item.id)), diagnostics, { ignoreMissing: true, appliedIds })
    return canonicalSection
  })
  for (const override of overrides) {
    if (!appliedIds.has(override.id)) applyOverrides({ sections }, [override], diagnostics)
  }
  return {
    schemaVersion: 1,
    scoreId: relativeScore.scoreId,
    profile: profile.id,
    meta: structuredClone(relativeScore.meta),
    sources: structuredClone(relativeScore.sources),
    sections,
    diagnostics,
  }
}
