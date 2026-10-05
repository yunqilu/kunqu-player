// 时长排版视图的轨道开关，存在 localStorage 里。
// 存储可能不可用（隐私模式、被禁用、配额满），所以读写都不能抛错。

// 显示名在 i18n 对照表里：track.gongche / track.qiangge / track.breath / track.action
export const TRACKS = [
  { key: 'gongche' },
  { key: 'qiangge' },
  { key: 'breath' },
  { key: 'action' },
]

const KEY = 'kunqu-player.phraseFlow.tracks'

function defaultStorage() {
  try { return globalThis.localStorage ?? null } catch { return null }
}

export function loadTrackPrefs(storage = defaultStorage()) {
  const prefs = Object.fromEntries(TRACKS.map((t) => [t.key, true]))
  try {
    const stored = JSON.parse(storage.getItem(KEY))
    for (const { key } of TRACKS) {
      if (typeof stored?.[key] === 'boolean') prefs[key] = stored[key]
    }
  } catch { /* 没有存储或数据损坏：用默认值 */ }
  return prefs
}

export function saveTrackPrefs(prefs, storage = defaultStorage()) {
  try { storage.setItem(KEY, JSON.stringify(prefs)) } catch { /* 存不了就算了，开关本次仍有效 */ }
}
