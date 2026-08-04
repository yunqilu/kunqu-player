import { describe, expect, test } from 'vitest'

import projection from '../../src/data/viewerModel.json'
import playbackProfile from '../../src/data/profiles/gongchepu-playback-2020-v1.json'
import reviewManifest from '../../src/data/reviews/xunmeng.review.json'
import { convertKunquScore } from '../../src/score/pipeline.js'
import { projectionHash } from '../../src/score/review/compileReview.js'

describe('Xunmeng reviewed score', () => {
  test('applies the evidenced Yang correction and parses exactly 796 written notes', () => {
    const result = convertKunquScore({ projection, reviewManifest, playbackProfile })
    const notes = result.relativeScore.sections.flatMap((section) => section.events).filter((event) => event.kind === 'note')
    const yang = result.reviewedSource.lines.find((line) => line.id === 'line-35').chars[13]

    expect(yang.ch).toBe('杨')
    expect(yang.gc.map((item) => item.raw)).toEqual(['工3', '六2/', '五46', '六', '工3/', '上+2d'])
    expect(notes).toHaveLength(796)
    expect(result.reviewedSource.textClassifications).toHaveLength(149)
    expect(result.diagnostics.some((item) => item.severity === 'fatal')).toBe(false)
    expect(result.musicXml).toContain('<score-partwise version="4.0">')
    expect(result.musicXml).not.toContain('<gongche>')
    expect(result.musicXml).not.toContain('gongche-raw=')
    const playbackCounts = Object.fromEntries([...new Set(result.playbackPlan.events.map((event) => event.kind))].map((kind) => [
      kind, result.playbackPlan.events.filter((event) => event.kind === kind).length,
    ]))
    expect(playbackCounts).toEqual({
      'sanban-timing': 864, vibrato: 839, slide: 716, 'same-pitch-reattack': 29,
      'qikou-pause': 163, 'phrase-ending': 10,
      'qiangge-articulation': 121, 'souqiang-realization': 14, 'huoqiang-realization': 34,
      'melodic-template': 220, 'hanqiang-template': 32,
    })
    const musicXmlIds = [...result.musicXml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]).filter((id) => id !== 'P1')
    expect(musicXmlIds.every((id) => result.relativeScore.provenanceIndex[id])).toBe(true)
  })

  test('has section-scoped tuning and remains invariant under timestamp changes', () => {
    const original = convertKunquScore({ projection, reviewManifest })
    const shifted = structuredClone(projection)
    for (const line of shifted.lines) {
      line.s += 10000; line.e += 20000
      for (const char of line.chars) {
        char.s += 30000; char.e += 40000
        for (const symbol of char.gc) { symbol.s = -123; symbol.e = 987654 }
      }
    }
    const changedManifest = {
      ...structuredClone(reviewManifest),
      base: { ...reviewManifest.base, sha256: projectionHash(shifted) },
    }
    const changed = convertKunquScore({ projection: shifted, reviewManifest: changedManifest })

    expect(original.canonicalScore.sections.map((section) => section.qupai?.value)).toEqual([
      '视频引子／念白（曲牌待复核）', '忒忒令', '嘉庆子', '尹令', '过场／念白（待复核）',
      '玉交枝', '念白（待复核）', '江儿水', '念白（待复核）', '尾声',
    ])
    expect(original.canonicalScore.sections.find((section) => section.id === 'xunmeng-teteling').tuning.value.dise).toBe('xiaogong')
    expect(original.musicXml).toContain('板式未定；时值仅供排谱')
    expect(changed.relativeScore.sections).toEqual(original.relativeScore.sections)
    expect(changed.canonicalScore.sections).toEqual(original.canonicalScore.sections)
    expect(changed.musicXml).toEqual(original.musicXml)
  })
})
