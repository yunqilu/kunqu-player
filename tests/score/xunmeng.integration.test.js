import { describe, expect, test } from 'vitest'

import projection from '../../src/data/viewerModel.json'
import playbackProfile from '../../src/data/profiles/gongchepu-playback-2020-v1.json'
import reviewManifest from '../../src/data/reviews/xunmeng.review.json'
import { convertKunquScore } from '../../src/score/pipeline.js'

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
    const changed = convertKunquScore({ projection: shifted, reviewManifest: { ...reviewManifest, base: undefined } })

    expect(original.canonicalScore.sections.map((section) => section.tuning.value.dise)).toEqual(['liuzi', 'xiaogong'])
    expect(changed.relativeScore.sections).toEqual(original.relativeScore.sections)
    expect(changed.canonicalScore.sections).toEqual(original.canonicalScore.sections)
    expect(changed.musicXml).toEqual(original.musicXml)
  })
})
