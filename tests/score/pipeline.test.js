import { describe, expect, test } from 'vitest'

import { convertKunquScore } from '../../src/score/pipeline.js'

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
  sources: [{ id: 'test-edition', title: '测试底本', kind: 'reviewed-score' }],
  corrections: [],
  sections: [],
  textClassifications: [],
  overrides: [],
}

describe('convertKunquScore', () => {
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
})
