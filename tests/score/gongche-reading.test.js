import { describe, expect, test } from 'vitest'

import { convertKunquScore } from '../../src/score/pipeline.js'
import { projectionHash } from '../../src/score/review/compileReview.js'

function convert(rawTokens, changes = {}) {
  const gc = rawTokens.map((raw, index) => ({
    raw,
    b: index === 0 ? '错误展开值' : null,
    r: 99,
    p: false,
    bt: '',
    o: '',
    q: false,
    s: 100 + index,
    e: 101 + index,
    ...changes.symbol,
  }))
  const projection = {
      meta: { title: '读谱测试' },
      lines: [{ id: 'line-a', s: 100, e: 200, text: '曲', chars: [{ ch: '曲', s: 100, e: 200, st: '普通唱', gc }] }],
      breaths: [],
      tracks: [],
  }
  return convertKunquScore({
    projection,
    reviewManifest: {
      schemaVersion: 1,
      scoreId: 'reading-test',
      profile: 'kunqu-default-v1',
      base: { sha256: projectionHash(projection) },
      sources: [{ id: 'edition', title: '底本', kind: 'reviewed-score' }],
      corrections: [],
      sections: [{ id: 'q1', qupai: '测试曲牌', start: { lineId: 'line-a', charIndex: 0 }, end: { lineId: 'line-a', charIndex: 0 }, banshi: 'sanban' }],
      textClassifications: [],
      overrides: [],
    },
  })
}

describe('strict Gongche reading through convertKunquScore', () => {
  test('preserves pitch, register, ordered anchors, breath, qiangge, and cross-token side notes', () => {
    const result = convert(['四2/（', '尺d）', '上+2s', '合', '四', '一'])
    const events = result.relativeScore.sections[0].events

    expect(events.map((event) => event.relativePitch.value)).toEqual([
      { degree: 6, octave: -1 },
      { degree: 2, octave: 0 },
      { degree: 1, octave: 1 },
      { degree: 5, octave: -1 },
      { degree: 6, octave: -1 },
      { degree: 7, octave: -1 },
    ])
    expect(events[0]).toMatchObject({ breathAfter: true, anchors: [{ code: '2' }], sideNote: false })
    expect(events[1]).toMatchObject({ sideNote: true, qiangge: [{ code: 'd', name: '叠腔' }] })
    expect(events[2]).toMatchObject({ anchors: [{ code: '2' }], qiangge: [{ code: 's', name: '擞腔' }] })
    expect(result.diagnostics.some((item) => item.code === 'FLATTENED_FIELD_MISMATCH')).toBe(true)
    expect(result.musicXml).not.toMatch(/[合四一上尺工凡六五乙]/)
  })

  test('does not let timestamps or flattened fields change score semantics', () => {
    const original = convert(['上+2s'])
    const changed = convert(['上+2s'], { symbol: { b: '乙', r: -1, p: true, bt: '888', o: 'hhh', q: true, s: 9000, e: 9999 } })

    expect(changed.relativeScore.sections).toEqual(original.relativeScore.sections)
    expect(changed.canonicalScore.sections).toEqual(original.canonicalScore.sections)
    expect(changed.musicXml).toEqual(original.musicXml)
  })

  test('reports unknown characters with an exact raw offset', () => {
    const result = convert(['上X'])
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'UNKNOWN_GONGCHE_CHARACTER',
      severity: 'fatal',
      sourceRef: expect.objectContaining({ rawStart: 1, rawEnd: 2 }),
    }))
  })
})
