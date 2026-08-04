import { describe, expect, test } from 'vitest'

import { convertKunquScore } from '../../src/score/pipeline.js'

function score(raws, banshi, sectionExtra = {}) {
  const chars = raws.map((raw, index) => ({
    ch: String.fromCharCode(65 + index),
    gc: [{ raw, b: raw[0], r: 0, p: false, bt: raw.replace(/\D/g, ''), o: '', q: raw.includes('/'), s: index * 10, e: index * 10 + 9 }],
    s: index * 10,
    e: index * 10 + 9,
    st: '普通唱',
  }))
  return convertKunquScore({
    projection: { meta: { title: '节奏测试' }, lines: [{ id: 'line-r', text: chars.map((item) => item.ch).join(''), chars, s: 0, e: 99 }] },
    reviewManifest: {
      schemaVersion: 1,
      scoreId: `rhythm-${banshi}`,
      profile: 'kunqu-default-v1',
      sources: [{ id: 'edition', title: '节奏底本', kind: 'reviewed-score' }],
      corrections: [],
      sections: [{
        id: 'section-r',
        qupai: '测试曲牌',
        start: { lineId: 'line-r', charIndex: 0 },
        end: { lineId: 'line-r', charIndex: chars.length - 1 },
        banshi: { value: banshi, status: 'confirmed', evidenceIds: ['edition'] },
        ...sectionExtra,
      }],
      textClassifications: [],
      overrides: [],
    },
  })
}

describe('canonical rhythm', () => {
  test('derives a confirmed one-ban-one-yan cycle from written anchors', () => {
    const result = score(['上1', '尺2'], 'one-ban-one-yan')
    const section = result.canonicalScore.sections[0]

    expect(section.meter.value).toEqual({ beats: 2, beatType: 4 })
    expect(section.events.map((event) => [event.onset.value, event.duration.value, event.duration.status])).toEqual([
      [{ numerator: 0, denominator: 1 }, { numerator: 1, denominator: 1 }, 'derived'],
      [{ numerator: 1, denominator: 1 }, { numerator: 1, denominator: 1 }, 'derived'],
    ])
    expect(section.measures[0].duration).toEqual({ numerator: 2, denominator: 1 })
  })

  test('does not turn a written breath into a canonical rest', () => {
    const result = score(['上1/'], 'one-ban-one-yan')
    const rests = result.canonicalScore.sections[0].events.filter((event) => event.kind === 'rest')

    expect(rests).toHaveLength(0)
    expect(result.musicXml).toContain('<breath-mark/>')
  })

  test('inserts an inferred rest only for an explicitly reviewed metric gap', () => {
    const result = score(['上1'], 'one-ban-one-yan', {
      metricGaps: [{ onset: { numerator: 1, denominator: 1 }, duration: { numerator: 1, denominator: 1 } }],
    })
    const rests = result.canonicalScore.sections[0].events.filter((event) => event.kind === 'rest')

    expect(rests).toHaveLength(1)
    expect(rests[0]).toMatchObject({
      restOrigin: 'metric-gap',
      duration: { value: { numerator: 1, denominator: 1 }, status: 'inferred' },
    })
    expect(result.musicXml.match(/<rest\/>/g)).toHaveLength(1)
  })

  test('exports sanban without a fixed meter and marks engraving durations inferred', () => {
    const result = score(['上', '尺'], 'sanban')
    const section = result.canonicalScore.sections[0]

    expect(section.meter.value).toEqual({ senzaMisura: true })
    expect(section.events.every((event) => event.duration.status === 'inferred')).toBe(true)
    expect(section.events.some((event) => event.kind === 'rest')).toBe(false)
    expect(result.musicXml).toContain('<senza-misura/>')
    expect(result.musicXml).toContain('散板；时值仅供排谱')
  })

  test('splits a sustained note across measures with traceable ties', () => {
    const result = score(['上121'], 'liushui')
    const notes = result.canonicalScore.sections[0].events.filter((event) => event.kind === 'note')

    expect(notes).toHaveLength(2)
    expect(notes.map((event) => event.tie)).toEqual([{ stop: false, start: true }, { stop: true, start: false }])
    expect(result.musicXml).toContain('<tie type="start"/>')
    expect(result.musicXml).toContain('<tied type="stop"/>')
    expect(notes.every((event) => result.relativeScore.provenanceIndex[event.id])).toBe(true)
  })
})
