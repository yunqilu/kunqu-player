import defaultProfile from '../../data/profiles/kunqu-default-v1.json' with { type: 'json' }
import { diagnostic } from '../diagnostics.js'
import { applyQianggeTiming, realizeQiangge } from './qiangge.js'
import { resolveRhythm, splitTiedEvents } from './rhythm.js'
import { resolveTuning } from './tuning.js'

export function createCanonicalScore(relativeScore, diagnostics, conversionProfile = null) {
  const profile = conversionProfile || defaultProfile
  const sections = relativeScore.sections.map((section) => {
    const tuning = resolveTuning(section, profile, diagnostics)
    const pitched = section.events.map((event) => ({ ...event, absolutePitch: tuning.pitch(event.relativePitch.value) }))
    const realized = realizeQiangge(section, pitched, diagnostics)
    for (const event of realized) {
      for (const qiangge of event.qiangge || []) {
        if (qiangge.code === 'h' || qiangge.code === 's') {
          diagnostics.push(diagnostic('QIANGGE_UNREALIZED', 'warning', `${qiangge.name}尚无审定微观展开`, { sourceRef: qiangge.sourceRef, eventIds: [event.id] }))
        }
      }
    }
    const rhythm = splitTiedEvents(applyQianggeTiming(section, resolveRhythm(section, realized, profile, diagnostics), diagnostics))
    return { ...section, tuning: tuning.context, meter: rhythm.meter, measures: rhythm.measures, events: rhythm.events }
  })
  return { schemaVersion: 1, scoreId: relativeScore.scoreId, profile: profile.id, sections, diagnostics }
}
