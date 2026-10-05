import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const phrase = (id, s, e, text, breaths = []) => ({
  id, s, e, text, breaths,
  chars: [...text].map((ch, k) => ({ ch, s: s + k, e: s + k + 1, st: '普通唱', gc: [] })),
})

const payload = () => ({
  meta: { title: '寻梦（牡丹亭）', performer: '顾卫英', source: '央视', video: 'x.mp4', span: [10, 40] },
  sections: [{ key: 's01', qupai: '懒画眉', kind: '唱', phrase_ids: ['p001', 'p002'] }],
  phrases: [
    phrase('p001', 10, 14, '一径行来', [{ t: 14.5, l: '', tk: 'a' }]),
    phrase('p002', 20, 26, '但觉思情辗转', [{ t: 21, l: '', tk: 'b' }, { t: 27, l: '', tk: 'c' }]),
  ],
  tracks: [{ id: 't1', name: '腔格轨', blocks: [], points: [] }],
  omitted: [{ lyric_text: '明', qupai: '玉交枝', reason: '演出漏唱' }],
  excluded: [{ ch: '哭？', s: 30, e: 31, reason: '用户决定删除' }],
  stats: { source_chars: 11, chars: 10, excluded: 1, phrases: 2, confirmed: 1, variant: 1, inferred: 0 },
})

const respond = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new SyntaxError('not json')
    return body
  },
})

let lib
beforeEach(async () => {
  vi.resetModules()
  lib = await import('../../src/lib/model.js')
})
afterEach(() => vi.unstubAllGlobals())

describe('loadModel', () => {
  it('requests the phrases of the piece from the API', async () => {
    const fetch = vi.fn(async () => respond(200, payload()))
    vi.stubGlobal('fetch', fetch)

    await lib.loadModel()

    expect(fetch).toHaveBeenCalledWith('/api/pieces/xunmeng/phrases')
  })

  it('fills the exported model in place, with lines = phrases', async () => {
    vi.stubGlobal('fetch', async () => respond(200, payload()))
    const before = lib.model

    const returned = await lib.loadModel()

    expect(returned).toBe(before)
    expect(lib.model).toBe(before)
    expect(lib.model.lines.map((l) => l.text)).toEqual(['一径行来', '但觉思情辗转'])
    expect(lib.model.meta.span).toEqual([10, 40])
    expect(lib.model.tracks).toEqual(payload().tracks)
    expect(lib.model.sections).toEqual(payload().sections)
    expect(lib.model.omitted).toEqual(payload().omitted)
    expect(lib.model.excluded).toEqual(payload().excluded)
    expect(lib.model.stats).toEqual(payload().stats)
  })

  it('rebuilds the flat breath list from the phrases, in time order', async () => {
    vi.stubGlobal('fetch', async () => respond(200, payload()))

    await lib.loadModel()

    expect(lib.model.breaths.map((b) => b.t)).toEqual([14.5, 21, 27])
  })

  it('makes the lookup helpers work on the loaded phrases', async () => {
    vi.stubGlobal('fetch', async () => respond(200, payload()))

    await lib.loadModel()

    expect(lib.bisectLine(5)).toBe(-1)
    expect(lib.bisectLine(12)).toBe(0)
    expect(lib.bisectLine(22)).toBe(1)
    expect(lib.breathAt(21.5, 20.5)).toBe(21)
  })

  it('is empty but safe to read before loading', () => {
    expect(lib.model.lines).toEqual([])
    expect(lib.model.breaths).toEqual([])
    expect(lib.model.tracks).toEqual([])
    expect(lib.bisectLine(12)).toBe(-1)
  })

  it('reports the backend detail when the piece is unknown', async () => {
    vi.stubGlobal('fetch', async () => respond(404, { detail: '没有曲目「nope」；可用的曲目：xunmeng' }))

    await expect(lib.loadModel('nope')).rejects.toThrow('没有曲目「nope」；可用的曲目：xunmeng')
    expect(lib.model.lines).toEqual([])
  })

  it('reports the status when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', async () => respond(500))

    await expect(lib.loadModel()).rejects.toThrow(/500/)
  })

  it('explains what to do when the backend cannot be reached', async () => {
    vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch') })

    await expect(lib.loadModel()).rejects.toThrow(/连不上后端.*make up/)
  })
})
