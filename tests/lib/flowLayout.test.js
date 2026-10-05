import { describe, expect, it } from 'vitest'
import { K_DEFAULT, W_MIN, layoutPhrase, spanX, timeToX } from '../../src/lib/flowLayout.js'

const phrase = (...spans) => ({
  s: spans[0][0],
  e: spans.at(-1)[1],
  chars: spans.map(([s, e], k) => ({ ch: String(k), s, e })),
})
const widths = (layout, kind = 'char') => layout.segments.filter((g) => g.kind === kind).map((g) => g.x1 - g.x0)

describe('layoutPhrase', () => {
  it('sizes a character block as W_MIN + K·√duration', () => {
    const layout = layoutPhrase(phrase([0, 1], [1, 5]))

    expect(widths(layout)).toEqual([W_MIN + K_DEFAULT, W_MIN + K_DEFAULT * 2])
    expect(layout.width).toBe(W_MIN * 2 + K_DEFAULT * 3)
    expect(layout.k).toBe(K_DEFAULT)
    expect(layout.scale).toBe(1)
  })

  it('makes longer characters wider but far less than proportionally', () => {
    const [short, long] = widths(layoutPhrase(phrase([0, 1], [1, 26])))

    expect(long).toBeGreaterThan(short)
    expect(long / short).toBeLessThan(5)
  })

  it('draws a pause between characters as K·√pause, with no base width', () => {
    const layout = layoutPhrase(phrase([0, 1], [5, 6]))

    expect(layout.segments.map((g) => g.kind)).toEqual(['char', 'gap', 'char'])
    expect(widths(layout, 'gap')).toEqual([K_DEFAULT * 2])
    expect(layout.segments[1]).toMatchObject({ t0: 1, t1: 5 })
  })

  it('ignores negligible and negative pauses', () => {
    expect(layoutPhrase(phrase([0, 1], [1.03, 2])).segments.map((g) => g.kind)).toEqual(['char', 'char'])
    expect(layoutPhrase(phrase([0, 1], [0.99, 2])).segments.map((g) => g.kind)).toEqual(['char', 'char'])
  })

  it('appends the pause before the next phrase, capped at 3 seconds of width', () => {
    const short = layoutPhrase(phrase([0, 1]), { tailEnd: 2 })
    const long = layoutPhrase(phrase([0, 1]), { tailEnd: 101 })

    expect(short.segments.at(-1)).toMatchObject({ kind: 'tail', t0: 1, t1: 2 })
    expect(widths(short, 'tail')).toEqual([K_DEFAULT])
    expect(long.segments.at(-1)).toMatchObject({ kind: 'tail', t0: 1, t1: 101 })
    expect(widths(long, 'tail')[0]).toBeCloseTo(K_DEFAULT * Math.sqrt(3))
  })

  it('has no tail for the last phrase or when phrases touch', () => {
    expect(layoutPhrase(phrase([0, 1])).segments.map((g) => g.kind)).toEqual(['char'])
    expect(layoutPhrase(phrase([0, 1]), { tailEnd: 1 }).segments.map((g) => g.kind)).toEqual(['char'])
  })

  it('shrinks K for a row that is too wide so that it fits exactly on one line', () => {
    const wide = phrase([0, 100], [100, 200], [200, 300])
    const layout = layoutPhrase(wide, { maxWidth: 300 })

    expect(layout.width).toBeCloseTo(300)
    expect(layout.k).toBeLessThan(K_DEFAULT)
    expect(layout.scale).toBe(1)
    expect(widths(layout).every((w) => w >= W_MIN)).toBe(true)
  })

  it('leaves rows that fit untouched, so K is shared across rows', () => {
    expect(layoutPhrase(phrase([0, 1], [1, 2]), { maxWidth: 300 }).k).toBe(K_DEFAULT)
  })

  it('falls back to scaling when even the base widths do not fit', () => {
    const many = phrase(...Array.from({ length: 10 }, (_, k) => [k, k + 1]))
    const layout = layoutPhrase(many, { maxWidth: 140 })

    expect(layout.k).toBe(0)
    expect(layout.width).toBe(W_MIN * 10)
    expect(layout.scale).toBeCloseTo(0.5)
  })
})

describe('timeToX', () => {
  const layout = layoutPhrase(phrase([10, 11], [15, 19]), { tailEnd: 20 })
  const [a, gap, b, tail] = layout.segments

  it('interpolates linearly inside a segment', () => {
    expect(timeToX(layout, 10)).toBe(0)
    expect(timeToX(layout, 10.5)).toBeCloseTo(a.x1 / 2)
    expect(timeToX(layout, 13)).toBeCloseTo((gap.x0 + gap.x1) / 2)
    expect(timeToX(layout, 17)).toBeCloseTo((b.x0 + b.x1) / 2)
    expect(timeToX(layout, 19.5)).toBeCloseTo((tail.x0 + tail.x1) / 2)
  })

  it('clamps times outside the row', () => {
    expect(timeToX(layout, 0)).toBe(0)
    expect(timeToX(layout, 99)).toBe(layout.width)
  })

  it('never goes backwards, even where characters overlap or pauses are skipped', () => {
    const messy = layoutPhrase(phrase([0, 1], [0.99, 2], [2.03, 3], [6, 7]), { tailEnd: 9 })
    let last = -1
    for (let t = -1; t <= 10; t += 0.01) {
      const x = timeToX(messy, t)
      expect(x).toBeGreaterThanOrEqual(last)
      last = x
    }
  })
})

describe('spanX', () => {
  const layout = layoutPhrase(phrase([0, 1], [1, 5], [5, 6]))
  const [a, b] = layout.segments

  it('makes a block as long as the characters it spans', () => {
    expect(spanX(layout, 0, 5)).toEqual({ x: 0, w: (a.x1 - a.x0) + (b.x1 - b.x0) })
  })

  it('keeps tiny blocks clickable with a minimum width', () => {
    expect(spanX(layout, 2, 2.001, 6).w).toBe(6)
  })
})

describe('packLines', () => {
  const pack = async (items, max) => (await import('../../src/lib/flowLayout.js')).packLines(items, max)

  it('keeps items on one line when they do not collide', async () => {
    const items = [{ x: 0, need: 10 }, { x: 10, need: 10 }, { x: 30, need: 10 }]

    expect(await pack(items)).toBe(1)
    expect(items.map((n) => n.line)).toEqual([0, 0, 0])
  })

  it('moves an item to the next line when the glyph before it is still in the way', async () => {
    const items = [{ x: 0, need: 20 }, { x: 5, need: 20 }, { x: 10, need: 20 }, { x: 22, need: 20 }]

    expect(await pack(items)).toBe(3)
    expect(items.map((n) => n.line)).toEqual([0, 1, 2, 0])
  })

  it('never uses more than the allowed lines; the least crowded line takes the overflow', async () => {
    const items = [{ x: 0, need: 30 }, { x: 1, need: 20 }, { x: 2, need: 30 }]

    expect(await pack(items, 2)).toBe(2)
    expect(items.map((n) => n.line)).toEqual([0, 1, 1])
  })

  it('reports zero lines for an empty row', async () => {
    expect(await pack([])).toBe(0)
  })
})
