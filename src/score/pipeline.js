import { compileReview } from './review/compileReview.js'
import { parseReviewedSource } from './gongche/parser.js'
import { createCanonicalScore } from './resolve/canonical.js'
import { renderPlayback } from './playback/renderPlayback.js'
import { exportMusicXml } from './musicxml/exporter.js'
import { stableId } from './ids.js'
import { diagnostic } from './diagnostics.js'
import defaultConversionProfile from '../data/profiles/kunqu-default-v1.json' with { type: 'json' }
import { validateArtifact } from './schema/validate.js'

export function convertKunquScore({ projection, reviewManifest, conversionProfile = null, playbackProfile = null }) {
  const manifestValidation = validateArtifact('reviewManifest', reviewManifest)
  if (!manifestValidation.valid) throw new TypeError(`Invalid review manifest: ${manifestValidation.errors.join('; ')}`)
  const diagnostics = []
  const selectedProfile = conversionProfile || defaultConversionProfile
  if (selectedProfile.id !== reviewManifest.profile) {
    diagnostics.push(diagnostic('PROFILE_MISMATCH', 'fatal', `校订清单要求 ${reviewManifest.profile}，实际提供 ${selectedProfile.id}`))
  }
  const reviewedSource = compileReview(projection, reviewManifest, diagnostics)
  const relativeScore = parseReviewedSource(reviewedSource, diagnostics)
  const canonicalScore = createCanonicalScore(relativeScore, diagnostics, selectedProfile, reviewManifest.overrides)
  for (const section of canonicalScore.sections) {
    for (const event of section.events) relativeScore.provenanceIndex[event.id] = {
      sourceRef: event.sourceRef || null,
      sourceEventIds: event.sourceEventIds || [],
      realizationId: event.realizationId || null,
      fields: Object.fromEntries(['relativePitch', 'absolutePitch', 'onset', 'duration'].filter((key) => event[key]).map((key) => [key, event[key]])),
    }
    for (const event of section.textEvents || []) relativeScore.provenanceIndex[event.id] ||= {
      sourceRef: event.sourceRef || null,
      sourceEventIds: event.sourceEventIds || [],
      fields: { text: { status: event.evidenceStatus, ruleId: event.ruleId } },
    }
  }
  const playbackPlan = renderPlayback(canonicalScore, playbackProfile)
  relativeScore.provenanceIndex.dir_inference_legend = { kind: 'legend' }
  for (const section of canonicalScore.sections) {
    relativeScore.provenanceIndex[stableId('dir', section.id, 'sanban')] = { sectionId: section.id, kind: 'sanban-label' }
    for (const measure of section.measures) {
      relativeScore.provenanceIndex[stableId('dir', section.id, measure.number - 1, 'inference')] = { sectionId: section.id, measureIndex: measure.number - 1, kind: 'inference-label' }
    }
  }
  for (const event of playbackPlan.events) {
    if (event.scoreMarker) relativeScore.provenanceIndex[event.scoreMarker.id] = { playbackEventId: event.id, sourceEventIds: event.sourceEventIds }
  }
  const musicXml = exportMusicXml(canonicalScore, playbackPlan.events.map((event) => event.scoreMarker).filter(Boolean), diagnostics)
  return { reviewedSource, relativeScore, canonicalScore, musicXml, playbackPlan, diagnostics }
}
