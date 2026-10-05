import { describe, expect, it } from 'vitest'
import { buildOutline } from '../../src/lib/outline.js'
import { setLang } from '../../src/i18n/index.js'
import { outlineModel } from './outline.fixture.js'

describe('buildOutline', () => {
  setLang('zh', null) // 这一组检查中文界面的标签和提示；英文见文件末尾
  const outline = buildOutline(outlineModel())

  it('makes one group per section, labelled by qupai or kind', () => {
    expect(outline.map((g) => [g.key, g.label, g.kind])).toEqual([
      ['s01', '【懒画眉】', '唱'],
      ['s02', '白', '白'],
      ['s03', '唱', '唱'],
    ])
  })

  it('counts phrases and inferred phrases per group', () => {
    expect(outline.map((g) => [g.count, g.inferred])).toEqual([[2, 0], [1, 0], [2, 2]])
  })

  it('lists phrases with their index into model.lines', () => {
    expect(outline.flatMap((g) => g.items.map((x) => [x.index, x.id, x.s, x.text, x.status]))).toEqual([
      [0, 'p001', 10, '一径行来', 'confirmed'],
      [1, 'p002', 20, '但觉思情辗转', 'variant'],
      [2, 'p003', 30, '昨日梦里', 'confirmed'],
      [3, 'p004', 40, '少不得楼上花枝', 'inferred'],
      [4, 'p005', 50, '也则是照独眠', 'inferred'],
    ])
  })

  it('gives confirmed phrases no tip', () => {
    expect(outline[0].items[0].tip).toBe('')
  })

  it('lists the differences of a variant phrase, without the routine break note', () => {
    expect(outline[0].items[1].tip).toBe('与歌词不同：\n演出「思」，歌词作「情」\n演出「情」，歌词作「思」')
  })

  it('shows all evidence of an inferred phrase', () => {
    expect(outline[2].items[0].tip).toBe('推定断句，依据：\n语义：完整分句\n句后停顿 0.00 秒')
  })

  it('fails loudly when a section names an unknown phrase', () => {
    const broken = outlineModel()
    broken.sections[0].phrase_ids.push('p999')

    expect(() => buildOutline(broken)).toThrow(/p999/)
  })
})

describe('buildOutline in English', () => {
  setLang('en', null)
  const outline = buildOutline(outlineModel())
  setLang('zh', null)

  it('labels sections with toned pinyin or Sung / Spoken', () => {
    expect(outline.map((g) => g.label)).toEqual(['Lǎn Huà Méi', 'Spoken', 'Sung'])
  })

  it('explains qupai on hover, and only on qupai headings', () => {
    expect(outline.map((g) => g.labelTip)).toEqual(['qupai — a named tune pattern', '', ''])
  })

  it('introduces the evidence in English and keeps the lyrics Chinese', () => {
    expect(outline[2].items[0].tip.split('\n')[0]).toBe('Inferred phrase break. Evidence:')
    expect(outline[0].items[1].tip.split('\n')[0]).toBe('Differs from the libretto:')
    expect(outline[0].items[0].text).toBe('一径行来')
  })
})
