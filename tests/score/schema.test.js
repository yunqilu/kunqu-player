import { describe, expect, test } from 'vitest'

import { validateArtifact, validateMusicXml } from '../../src/score/schema/validate.js'
import { validateMusicXmlWithXsd } from '../../src/score/schema/validateMusicXmlNode.js'
import { convertKunquScore } from '../../src/score/pipeline.js'
import { projectionHash } from '../../src/score/review/compileReview.js'

const projection = {
  meta: { title: 'Schema' },
  lines: [{ id: 'l', text: '甲', chars: [{ ch: '甲', gc: [{ raw: '上' }] }] }],
}
const manifest = {
  schemaVersion: 1, scoreId: 'schema-test', profile: 'kunqu-default-v1',
  base: { sha256: projectionHash(projection) },
  sources: [{ id: 's', title: '底本', kind: 'reviewed-score' }],
  corrections: [], sections: [], textClassifications: [], overrides: [],
}

describe('artifact contracts', () => {
  test('validates every structured artifact and MusicXML from the public pipeline', () => {
    const result = convertKunquScore({ projection, reviewManifest: manifest })
    expect(validateArtifact('reviewManifest', manifest).valid).toBe(true)
    expect(validateArtifact('reviewedSource', result.reviewedSource).valid).toBe(true)
    expect(validateArtifact('relativeScore', result.relativeScore).valid).toBe(true)
    expect(validateArtifact('canonicalScore', result.canonicalScore).valid).toBe(true)
    expect(validateArtifact('playbackPlan', result.playbackPlan).valid).toBe(true)
    expect(validateMusicXml(result.musicXml).valid).toBe(true)
    const xsd = validateMusicXmlWithXsd(result.musicXml)
    expect(xsd.valid === null || xsd.valid).toBe(true)
  })

  test('rejects a confirmed evidence value without evidence or an editorial note', () => {
    const result = convertKunquScore({ projection, reviewManifest: manifest })
    result.canonicalScore.sections[0].tuning = {
      value: { shangPitch: 'D4' }, status: 'confirmed', ruleId: null, evidenceIds: [], note: null,
    }
    expect(validateArtifact('canonicalScore', result.canonicalScore)).toMatchObject({ valid: false })
  })

  test('rejects malformed correction targets before compilation', () => {
    const malformed = structuredClone(manifest)
    malformed.corrections.push({ id: 'bad', op: 'replaceCharGongche', target: { lineId: 'l' }, raw: [], status: 'confirmed', evidenceIds: [] })

    expect(validateArtifact('reviewManifest', malformed).valid).toBe(false)
  })
})
