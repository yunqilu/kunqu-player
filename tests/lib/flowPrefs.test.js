import { describe, expect, it } from 'vitest'
import { TRACKS, loadTrackPrefs, saveTrackPrefs } from '../../src/lib/flowPrefs.js'

const memory = (initial = {}) => {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v) },
  }
}
const broken = {
  getItem() { throw new Error('denied') },
  setItem() { throw new Error('quota') },
}
const ALL_ON = { gongche: true, qiangge: true, breath: true, action: true }

describe('track preferences', () => {
  it('lists the four toggleable tracks in display order', () => {
    expect(TRACKS.map((t) => t.key)).toEqual(['gongche', 'qiangge', 'breath', 'action'])
  })

  it('shows every track by default', () => {
    expect(loadTrackPrefs(memory())).toEqual(ALL_ON)
  })

  it('round-trips through storage', () => {
    const storage = memory()

    saveTrackPrefs({ ...ALL_ON, gongche: false }, storage)

    expect(loadTrackPrefs(storage)).toEqual({ ...ALL_ON, gongche: false })
  })

  it('ignores unknown keys and non-boolean values in stored data', () => {
    const storage = memory({ 'kunqu-player.phraseFlow.tracks': '{"breath":false,"action":"no","junk":true}' })

    expect(loadTrackPrefs(storage)).toEqual({ ...ALL_ON, breath: false })
  })

  it('falls back to defaults when stored data is corrupt', () => {
    expect(loadTrackPrefs(memory({ 'kunqu-player.phraseFlow.tracks': '{not json' }))).toEqual(ALL_ON)
    expect(loadTrackPrefs(memory({ 'kunqu-player.phraseFlow.tracks': 'null' }))).toEqual(ALL_ON)
  })

  it('never throws when storage is unavailable', () => {
    expect(loadTrackPrefs(broken)).toEqual(ALL_ON)
    expect(() => saveTrackPrefs(ALL_ON, broken)).not.toThrow()
    expect(loadTrackPrefs(null)).toEqual(ALL_ON)
    expect(() => saveTrackPrefs(ALL_ON, null)).not.toThrow()
  })
})
