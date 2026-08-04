import { describe, expect, test } from 'vitest'

import { convertKunquScore } from '../../src/score/pipeline.js'
import { projectionHash } from '../../src/score/review/compileReview.js'

const projection = {
  meta: { title: '测试曲' },
  lines: [
    {
      id: 'line-1',
      s: 1,
      e: 2,
      text: '春',
      chars: [
        {
          ch: '春',
          s: 1,
          e: 2,
          st: '普通唱',
          gc: [{ raw: '上', b: '上', r: 0, p: false, bt: '', o: '', q: false, s: 1, e: 2 }],
        },
      ],
    },
  ],
  breaths: [],
  tracks: [],
}

const reviewManifest = {
  schemaVersion: 1,
  scoreId: 'test-score',
  profile: 'kunqu-default-v1',
  base: { sha256: projectionHash(projection) },
  sources: [{ id: 'test-edition', title: '测试底本', kind: 'reviewed-score' }],
  corrections: [],
  sections: [],
  textClassifications: [],
  overrides: [],
}

describe('convertKunquScore', () => {
  test('rejects a review manifest without a pinned source projection', () => {
    expect(() => convertKunquScore({
      projection,
      reviewManifest: { ...reviewManifest, base: undefined },
    })).toThrow(/required property 'base'/)
  })

  test('converts one Gongche note through every reviewable artifact', () => {
    const result = convertKunquScore({ projection, reviewManifest })
    const repeated = convertKunquScore({ projection, reviewManifest })

    expect(Object.keys(result)).toEqual([
      'reviewedSource',
      'relativeScore',
      'canonicalScore',
      'musicXml',
      'playbackPlan',
      'diagnostics',
    ])
    expect(result.relativeScore.sections[0].events).toHaveLength(1)
    expect(result.relativeScore.sections[0].events[0].relativePitch.value).toEqual({ degree: 1, octave: 0 })
    expect(result.canonicalScore.sections[0].events[0].absolutePitch).toMatchObject({
      value: { step: 'D', alter: 0, octave: 4 },
      status: 'inferred',
      ruleId: 'default-1-equals-d-v1',
    })
    expect(result.musicXml).toContain('<step>D</step>')
    expect(result.musicXml).not.toMatch(/[合四一上尺工凡六五乙]/)
    expect(result.playbackPlan.events).toEqual([])
    expect(result).toEqual(repeated)
  })

  test('requires the supplied conversion profile to match the reviewed profile', () => {
    const customProfile = {
      id: 'custom-v1', version: 1, referenceHz: 440, temperament: '12-TET', defaultShangMidi: 60,
      diseShangMidi: {}, banshiMeters: { sanban: { senzaMisura: true } }, anchorPositions: {},
    }
    const result = convertKunquScore({
      projection,
      reviewManifest: { ...reviewManifest, profile: 'custom-v1' },
      conversionProfile: customProfile,
    })

    expect(result.relativeScore.profileVersions).toEqual(['custom-v1'])
    expect(result.canonicalScore.profile).toBe('custom-v1')
    expect(result.canonicalScore.sections[0].events[0].absolutePitch.value).toMatchObject({ step: 'C', octave: 4 })
    expect(result.diagnostics.some((item) => item.code === 'PROFILE_MISMATCH')).toBe(false)
  })

  test('replays a relative-pitch override before dependent absolute tuning', () => {
    const first = convertKunquScore({ projection, reviewManifest })
    const id = first.relativeScore.sections[0].events[0].id
    const replayed = convertKunquScore({
      projection,
      reviewManifest: {
        ...reviewManifest,
        overrides: [{
          id: 'override-relative', targetId: id, fieldPath: 'relativePitch',
          value: { degree: 2, octave: 0 }, status: 'confirmed', evidenceIds: [], note: '谱师确认',
        }],
      },
    })

    expect(replayed.canonicalScore.sections[0].events[0].relativePitch.status).toBe('confirmed')
    expect(replayed.canonicalScore.sections[0].events[0].absolutePitch.value.midi).toBe(64)
  })

  test('reports overlapping section assignments as fatal', () => {
    const section = { start: { lineId: 'line-1', charIndex: 0 }, end: { lineId: 'line-1', charIndex: 0 }, banshi: 'sanban' }
    const result = convertKunquScore({
      projection,
      reviewManifest: { ...reviewManifest, sections: [{ id: 'a', ...section }, { id: 'b', ...section }] },
    })

    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'SECTION_GAP_OR_OVERLAP', severity: 'fatal' }))
  })

  test('reports the actual Shang pitch selected by a reviewed dise', () => {
    const result = convertKunquScore({
      projection,
      reviewManifest: {
        ...reviewManifest,
        sections: [{
          id: 'liuzi', start: { lineId: 'line-1', charIndex: 0 }, end: { lineId: 'line-1', charIndex: 0 },
          dise: { value: 'liuzi', status: 'confirmed', evidenceIds: ['test-edition'] }, banshi: 'sanban',
        }],
      },
    })

    expect(result.canonicalScore.sections[0].tuning.value).toMatchObject({ dise: 'liuzi', shangPitch: 'F4', shangMidi: 65 })
  })
})
