import { describe, expect, test } from 'vitest'

import playbackProfile from '../../src/data/profiles/gongchepu-playback-2020-v1.json'
import { convertKunquScore } from '../../src/score/pipeline.js'
import { projectionHash } from '../../src/score/review/compileReview.js'

function run(playback = null) {
  const projection = {
      meta: { title: '试听测试' },
      lines: [{
        id: 'line-p', s: 0, e: 20, text: '甲乙丙',
        chars: [
          { ch: '甲', s: 0, e: 4, st: '普通唱', gc: [{ raw: '上/', b: '上', r: 0, p: false, bt: '', o: '', q: true }] },
          { ch: '乙', s: 9, e: 12, st: '普通唱', gc: [{ raw: '上', b: '上', r: 0, p: false, bt: '', o: '', q: false }] },
          { ch: '丙', s: 15, e: 20, st: '普通唱', gc: [{ raw: '一', b: '一', r: 0, p: false, bt: '', o: '', q: false }] },
        ],
      }],
  }
  return convertKunquScore({
    projection,
    reviewManifest: {
      schemaVersion: 1,
      scoreId: 'playback-test',
      profile: 'kunqu-default-v1',
      base: { sha256: projectionHash(projection) },
      sources: [{ id: 'edition', title: '试听底本', kind: 'reviewed-score' }],
      corrections: [],
      sections: [{ id: 'p', start: { lineId: 'line-p', charIndex: 0 }, end: { lineId: 'line-p', charIndex: 2 }, banshi: 'sanban' }],
      textClassifications: [],
      overrides: [],
    },
    playbackProfile: playback,
  })
}

function runRaw(raw, tone = null) {
  const projection = { meta: { title: '源码向量' }, lines: [{ id: 'vector', text: '甲', chars: [{ ch: '甲', tone, st: '普通唱', gc: [{ raw }] }] }] }
  return convertKunquScore({
    projection,
    reviewManifest: {
      schemaVersion: 1, scoreId: `vector-${raw}`, profile: 'kunqu-default-v1',
      base: { sha256: projectionHash(projection) },
      sources: [{ id: 'edition', title: '源码向量', kind: 'reviewed-score' }], corrections: [],
      sections: [{ id: 'vector-section', start: { lineId: 'vector', charIndex: 0 }, end: { lineId: 'vector', charIndex: 0 }, banshi: 'sanban' }],
      textClassifications: [], overrides: [],
    },
    playbackProfile,
  })
}

function runMeteredFinalBreath() {
  const projection = {
    meta: { title: '末小节气口' },
    lines: [{
      id: 'metered', text: '甲乙', chars: [
        { ch: '甲', st: '普通唱', gc: [{ raw: '上1' }] },
        { ch: '乙', st: '普通唱', gc: [{ raw: '尺2/' }] },
      ],
    }],
  }
  return convertKunquScore({
    projection,
    reviewManifest: {
      schemaVersion: 1, scoreId: 'metered-final-breath', profile: 'kunqu-default-v1',
      base: { sha256: projectionHash(projection) },
      sources: [{ id: 'edition', title: '气口测试', kind: 'reviewed-score' }], corrections: [],
      sections: [{
        id: 'metered-section', start: { lineId: 'metered', charIndex: 0 }, end: { lineId: 'metered', charIndex: 1 },
        banshi: { value: 'one-ban-one-yan', status: 'confirmed', evidenceIds: ['edition'] },
      }],
      textClassifications: [], overrides: [],
    },
    playbackProfile,
  })
}

describe('separate Playback Plan', () => {
  test('adds versioned website-compatible effects without changing score semantics', () => {
    const scoreOnly = run()
    const withPlayback = run(playbackProfile)
    const kinds = withPlayback.playbackPlan.events.map((event) => event.kind)

    expect(kinds).toContain('qikou-pause')
    expect(kinds).not.toContain('rusheng-template')
    expect(kinds).toContain('same-pitch-reattack')
    expect(kinds).toContain('phrase-ending')
    expect(kinds).toContain('sanban-timing')
    expect(kinds).toContain('slide')
    expect(kinds).toContain('vibrato')
    expect(withPlayback.playbackPlan).toMatchObject({
      profile: 'gongchepu-playback-2020-v1',
      sourceImplementation: { sha256: '6f8d060b486d1a2aafacc582d4e12d64a5d25c777624b3684cf2900f412f4db8' },
    })
    expect(withPlayback.canonicalScore).toEqual(scoreOnly.canonicalScore)
    expect(withPlayback.playbackPlan.events.every((event) => event.sourceEventIds.length > 0 && event.ruleId)).toBe(true)
    expect(withPlayback.playbackPlan.events.every((event) => event.inputHash && event.sourceImplementationSha256)).toBe(true)
  })

  test('projects concise purple effect names but never playback notes or rests into MusicXML', () => {
    const scoreOnly = run()
    const withPlayback = run(playbackProfile)
    const count = (xml, tag) => (xml.match(new RegExp(`<${tag}(?: |>)`, 'g')) || []).length

    expect(count(withPlayback.musicXml, 'note')).toBe(count(scoreOnly.musicXml, 'note'))
    expect(count(withPlayback.musicXml, 'rest')).toBe(count(scoreOnly.musicXml, 'rest'))
    expect(withPlayback.musicXml).toContain('color="#7E22CE"')
    expect(withPlayback.musicXml).toContain('气口停顿')
    expect(withPlayback.musicXml).toContain('<offset sound="no">')
    expect(withPlayback.musicXml).not.toMatch(/<words color="#7E22CE">[^<]*试听/)
  })

  test('matches pinned website vectors for hanqiang and explicit h/s realizations', () => {
    const han = runRaw('上四上尺').playbackPlan.events.find((event) => event.kind === 'hanqiang-template')
    const qiangge = runRaw('上h尺s').playbackPlan.events

    expect(han.parameters).toMatchObject({ relativeValues: [0, -3, 0, 2], websiteDurations: [0.3, 0.3, 0.6] })
    expect(qiangge.map((event) => event.kind)).toEqual(expect.arrayContaining(['huoqiang-realization', 'souqiang-realization']))
  })

  test('keeps breath and rusheng separate unless an entering tone is explicit', () => {
    const ordinary = runRaw('上/尺').playbackPlan.events.map((event) => event.kind)
    const entering = runRaw('上/尺', '阴入').playbackPlan.events.map((event) => event.kind)

    expect(ordinary).toContain('qikou-pause')
    expect(ordinary).not.toContain('rusheng-template')
    expect(entering).toContain('rusheng-template')
  })

  test('keeps a final-boundary qikou marker in the last existing measure', () => {
    const result = runMeteredFinalBreath()
    const marker = result.playbackPlan.events.find((event) => event.kind === 'qikou-pause').scoreMarker

    expect(marker.measureIndex).toBe(0)
    expect(marker.beatOffset).toEqual({ numerator: 2, denominator: 1 })
    expect(result.musicXml).toContain(`id="${marker.id}"`)
    expect(result.musicXml).toContain('<offset sound="no">2</offset>')
  })
})
