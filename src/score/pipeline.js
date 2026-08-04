import { compileReview } from './review/compileReview.js'
import { applyOverrides } from './review/applyOverrides.js'
import { parseReviewedSource } from './gongche/parser.js'
import { createCanonicalScore } from './resolve/canonical.js'
import { renderPlayback } from './playback/renderPlayback.js'
import { exportMusicXml } from './musicxml/exporter.js'

export function convertKunquScore({ projection, reviewManifest, conversionProfile = null, playbackProfile = null }) {
  const diagnostics = []
  const reviewedSource = compileReview(projection, reviewManifest, diagnostics)
  const relativeScore = parseReviewedSource(reviewedSource, diagnostics)
  const canonicalScore = applyOverrides(
    createCanonicalScore(relativeScore, diagnostics, conversionProfile),
    reviewManifest.overrides,
    diagnostics,
  )
  for (const section of canonicalScore.sections) {
    for (const event of section.events) relativeScore.provenanceIndex[event.id] = event.sourceRef || null
  }
  const playbackPlan = renderPlayback(canonicalScore, playbackProfile)
  const musicXml = exportMusicXml(canonicalScore, playbackPlan.events.map((event) => event.scoreMarker).filter(Boolean))
  return { reviewedSource, relativeScore, canonicalScore, musicXml, playbackPlan, diagnostics }
}
