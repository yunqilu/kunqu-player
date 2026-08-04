import { describe, expect, test } from 'vitest'

import playbackProfile from '../../src/data/profiles/gongchepu-playback-2020-v1.json'
import { convertKunquScore } from '../../src/score/pipeline.js'

function run(playback = null) {
  return convertKunquScore({
    projection: {
      meta: { title: '试听测试' },
      lines: [{
        id: 'line-p', s: 0, e: 20, text: '甲乙丙',
        chars: [
          { ch: '甲', s: 0, e: 4, st: '普通唱', gc: [{ raw: '上/', b: '上', r: 0, p: false, bt: '', o: '', q: true }] },
          { ch: '乙', s: 9, e: 12, st: '普通唱', gc: [{ raw: '上', b: '上', r: 0, p: false, bt: '', o: '', q: false }] },
          { ch: '丙', s: 15, e: 20, st: '普通唱', gc: [{ raw: '一', b: '一', r: 0, p: false, bt: '', o: '', q: false }] },
        ],
      }],
    },
    reviewManifest: {
      schemaVersion: 1,
      scoreId: 'playback-test',
      profile: 'kunqu-default-v1',
      sources: [{ id: 'edition', title: '试听底本', kind: 'reviewed-score' }],
      corrections: [],
      sections: [{ id: 'p', start: { lineId: 'line-p', charIndex: 0 }, end: { lineId: 'line-p', charIndex: 2 }, banshi: 'sanban' }],
      textClassifications: [],
      overrides: [],
    },
    playbackProfile: playback,
  })
}

describe('separate Playback Plan', () => {
  test('adds versioned website-compatible effects without changing score semantics', () => {
    const scoreOnly = run()
    const withPlayback = run(playbackProfile)
    const kinds = withPlayback.playbackPlan.events.map((event) => event.kind)

    expect(kinds).toContain('qikou-pause')
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
  })

  test('projects concise purple effect names but never playback notes or rests into MusicXML', () => {
    const scoreOnly = run()
    const withPlayback = run(playbackProfile)
    const count = (xml, tag) => (xml.match(new RegExp(`<${tag}(?: |>)`, 'g')) || []).length

    expect(count(withPlayback.musicXml, 'note')).toBe(count(scoreOnly.musicXml, 'note'))
    expect(count(withPlayback.musicXml, 'rest')).toBe(count(scoreOnly.musicXml, 'rest'))
    expect(withPlayback.musicXml).toContain('color="#7E22CE"')
    expect(withPlayback.musicXml).toContain('气口停顿')
    expect(withPlayback.musicXml).not.toContain('试听')
  })
})
