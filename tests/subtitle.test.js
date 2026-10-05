import { describe, expect, it } from 'vitest'
import { BRIDGE_GAP, loadSubtitlePref, saveSubtitlePref, subtitleIndex } from '../src/lib/subtitle.js'

// 四句：0→1 之间是 0.3 秒的短空隙，1→2 之间是 3 秒的过门，2→3 恰好是 0.4 秒
const lines = [
  { s: 10, e: 14 },
  { s: 14.3, e: 18 },
  { s: 21, e: 25 },
  { s: 25.4, e: 28 },
]

describe('subtitleIndex', () => {
  it('bridges gaps shorter than 0.4 seconds', () => {
    expect(BRIDGE_GAP).toBe(0.4)
  })

  it('shows the phrase being sung', () => {
    expect(subtitleIndex(lines, 12)).toBe(0)
    expect(subtitleIndex(lines, 22)).toBe(2)
  })

  it('shows a phrase from the moment it starts', () => {
    expect(subtitleIndex(lines, 10)).toBe(0)
    expect(subtitleIndex(lines, 21)).toBe(2)
  })

  it('hides the subtitle exactly at the end of a phrase followed by a long gap', () => {
    expect(subtitleIndex(lines, 18)).toBe(-1)
  })

  it('keeps the phrase through a short gap instead of flickering', () => {
    expect(subtitleIndex(lines, 14)).toBe(0)
    expect(subtitleIndex(lines, 14.2)).toBe(0)
    expect(subtitleIndex(lines, 14.3)).toBe(1)
  })

  it('hides the subtitle during a long gap', () => {
    expect(subtitleIndex(lines, 19.5)).toBe(-1)
    expect(subtitleIndex(lines, 20.99)).toBe(-1)
  })

  it('does not bridge a gap of exactly 0.4 seconds', () => {
    expect(subtitleIndex(lines, 25.2)).toBe(-1)
  })

  it('shows nothing before the first phrase', () => {
    expect(subtitleIndex(lines, 0)).toBe(-1)
    expect(subtitleIndex(lines, 9.99)).toBe(-1)
  })

  it('shows nothing after the last phrase', () => {
    expect(subtitleIndex(lines, 28)).toBe(-1)
    expect(subtitleIndex(lines, 500)).toBe(-1)
  })

  it('depends only on the time, so seeking backwards lands on the right phrase', () => {
    const forward = [12, 22, 27].map((t) => subtitleIndex(lines, t))
    const back = [27, 22, 12].map((t) => subtitleIndex(lines, t))

    expect(forward).toEqual([0, 2, 3])
    expect(back).toEqual([3, 2, 0])
    expect(subtitleIndex(lines, 19.5)).toBe(-1)
  })

  it('copes with no phrases', () => {
    expect(subtitleIndex([], 5)).toBe(-1)
  })
})

describe('subtitle preference', () => {
  const memory = (initial = {}) => {
    const data = { ...initial }
    return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v) } }
  }
  const broken = {
    getItem() { throw new Error('denied') },
    setItem() { throw new Error('quota') },
  }

  it('is on by default', () => {
    expect(loadSubtitlePref(memory())).toBe(true)
  })

  it('remembers being switched off and on', () => {
    const storage = memory()

    saveSubtitlePref(false, storage)
    expect(loadSubtitlePref(storage)).toBe(false)
    saveSubtitlePref(true, storage)
    expect(loadSubtitlePref(storage)).toBe(true)
  })

  it('falls back to on when storage is unavailable or holds junk', () => {
    expect(loadSubtitlePref(broken)).toBe(true)
    expect(loadSubtitlePref(memory({ 'kunqu-player.subtitles': 'maybe' }))).toBe(true)
    expect(() => saveSubtitlePref(false, broken)).not.toThrow()
  })
})
