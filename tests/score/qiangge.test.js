import { describe, expect, test } from 'vitest'

import { convertKunquScore } from '../../src/score/pipeline.js'
import { projectionHash } from '../../src/score/review/compileReview.js'

function convert(raw) {
  const projection = {
      meta: { title: '腔格测试' },
      lines: [{
        id: 'line-q', s: 0, e: 10, text: '甲乙',
        chars: [
          { ch: '甲', s: 0, e: 5, st: '普通唱', gc: [{ raw, b: raw[0], r: 0, p: false, bt: '', o: '', q: false }] },
          { ch: '乙', s: 5, e: 10, st: '普通唱', gc: [] },
        ],
      }],
  }
  return convertKunquScore({
    projection,
    reviewManifest: {
      schemaVersion: 1,
      scoreId: 'qiangge-test',
      profile: 'kunqu-default-v1',
      base: { sha256: projectionHash(projection) },
      sources: [{ id: 'edition', title: '腔格底本', kind: 'reviewed-score' }],
      corrections: [],
      sections: [{ id: 'q', start: { lineId: 'line-q', charIndex: 0 }, end: { lineId: 'line-q', charIndex: 1 }, banshi: 'sanban' }],
      textClassifications: [{
        target: { lineId: 'line-q', charIndex: 1 }, kind: 'unresolved',
        status: 'unresolved', ruleId: 'test-unresolved-v1',
      }],
      overrides: [],
    },
  })
}

function convertAcrossWords(sectionExtra = { phrases: [{ status: 'confirmed', start: { lineId: 'line-cross', charIndex: 0 }, end: { lineId: 'line-cross', charIndex: 1 } }] }) {
  const projection = {
      meta: { title: '跨字掇腔' },
      lines: [{
        id: 'line-cross', text: '甲乙',
        chars: [
          { ch: '甲', st: '普通唱', gc: [{ raw: '尺c' }] },
          { ch: '乙', st: '普通唱', gc: [{ raw: '上' }] },
        ],
      }],
  }
  return convertKunquScore({
    projection,
    reviewManifest: {
      schemaVersion: 1, scoreId: 'qiangge-cross', profile: 'kunqu-default-v1',
      base: { sha256: projectionHash(projection) },
      sources: [{ id: 'edition', title: '腔格底本', kind: 'reviewed-score' }], corrections: [],
      sections: [{
        id: 'cross', start: { lineId: 'line-cross', charIndex: 0 }, end: { lineId: 'line-cross', charIndex: 1 },
        banshi: 'sanban', ...sectionExtra,
      }],
      textClassifications: [], overrides: [],
    },
  })
}

describe('explicit qiangge realization', () => {
  test('each d creates one same-pitch repetition and one green label', () => {
    const result = convert('五dd')
    const events = result.canonicalScore.sections[0].events.filter((event) => event.kind === 'note')

    expect(events).toHaveLength(3)
    expect(events.map((event) => event.absolutePitch.value.midi)).toEqual([71, 71, 71])
    expect(events[0].qiangge.map((item) => item.name)).toEqual(['叠腔', '叠腔'])
    expect(events.slice(1).every((event) => event.realizationRole === 'repeat')).toBe(true)
    expect(result.musicXml.match(/叠腔/g)).toHaveLength(1)
  })

  test('c creates a distinct-pitch stop-rest-carry sequence in a 2:1:1 ratio', () => {
    const result = convert('尺c上')
    const events = result.canonicalScore.sections[0].events

    expect(events.map((event) => [event.kind, event.realizationRole])).toEqual([
      ['note', 'stop'],
      ['rest', 'rest'],
      ['note', 'carry'],
    ])
    expect(events.filter((event) => event.kind === 'note').map((event) => event.absolutePitch.value.midi)).toEqual([64, 62])
    expect(events.map((event) => event.duration.value)).toEqual([
      { numerator: 1, denominator: 2 },
      { numerator: 1, denominator: 4 },
      { numerator: 1, denominator: 4 },
    ])
    expect(new Set(events.map((event) => event.realizationId)).size).toBe(1)
    expect(result.musicXml.match(/掇腔/g)).toHaveLength(1)
    expect(result.musicXml).toContain('color="#15803D"')
  })

  test('does not duplicate missing or repeated c realizations', () => {
    const duplicate = convert('尺cc上')
    expect(duplicate.canonicalScore.sections[0].events.filter((event) => event.kind === 'rest')).toHaveLength(1)
    expect(duplicate.diagnostics.some((item) => item.code === 'DUPLICATE_DUOQIANG_CODE')).toBe(true)

    const missing = convert('尺c')
    expect(missing.canonicalScore.sections[0].events).toHaveLength(1)
    expect(missing.diagnostics.some((item) => item.code === 'DUOQIANG_MISSING_TRAILING_NOTE')).toBe(true)
  })

  test('keeps unreviewed h and s as named ornaments without invented notes', () => {
    const result = convert('上hs')
    expect(result.canonicalScore.sections[0].events.filter((event) => event.kind === 'note')).toHaveLength(1)
    expect(result.musicXml).toContain('豁腔')
    expect(result.musicXml).toContain('擞腔')
    expect(result.diagnostics.filter((item) => item.code === 'QIANGGE_UNREALIZED')).toHaveLength(2)
  })

  test('preserves mixed structural code order without inventing an unreviewed combination', () => {
    const result = convert('尺cd上')

    expect(result.canonicalScore.sections[0].events.filter((event) => event.kind === 'note')).toHaveLength(2)
    expect(result.canonicalScore.sections[0].events.some((event) => event.kind === 'rest')).toBe(false)
    expect(result.diagnostics.some((item) => item.code === 'QIANGGE_ORDER_UNRESOLVED')).toBe(true)
  })

  test('does not consume a carry note across a confirmed phrase boundary', () => {
    const result = convertAcrossWords({
      phraseBoundaries: [{ status: 'confirmed', after: { lineId: 'line-cross', charIndex: 0, gongcheIndex: 0 } }],
    })

    expect(result.canonicalScore.sections[0].events.filter((event) => event.kind === 'rest')).toHaveLength(0)
    expect(result.diagnostics.some((item) => item.code === 'DUOQIANG_MISSING_TRAILING_NOTE')).toBe(true)
  })

  test('keeps a displaced lyric as an orange review direction instead of dropping it', () => {
    const result = convertAcrossWords()

    expect(result.diagnostics.some((item) => item.code === 'DUOQIANG_LYRIC_COLLISION')).toBe(true)
    expect(result.musicXml).toContain('待校文字：乙')
    expect(result.musicXml).toContain('color="#D97706"')
  })
})
