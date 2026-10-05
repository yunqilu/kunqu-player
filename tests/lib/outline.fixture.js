// 左栏目录测试共用的小模型：一段曲牌唱、一段念白、一段曲牌未知的推定唱。
const phrase = (n, s, text, extra = {}) => ({
  id: `p00${n}`, index: n - 1, s, e: s + 4, text,
  status: 'confirmed', evidence: ['歌词断句：句末标点「，」'], variants: [], breaths: [],
  chars: [...text].map((ch, k) => ({ ch, s: s + k * 0.5, e: s + k * 0.5 + 0.5, st: '普通唱', gc: [] })),
  ...extra,
})

export const outlineModel = () => {
  const phrases = [
    phrase(1, 10, '一径行来'),
    phrase(2, 20, '但觉思情辗转', {
      status: 'variant',
      evidence: ['歌词断句：句末标点「，」', '演出「思」，歌词作「情」', '演出「情」，歌词作「思」'],
      variants: [{ i: 6, performed: '思', lyric: '情' }, { i: 7, performed: '情', lyric: '思' }],
    }),
    phrase(3, 30, '昨日梦里'),
    phrase(4, 40, '少不得楼上花枝', {
      status: 'inferred',
      evidence: ['语义：完整分句', '句后停顿 0.00 秒'],
    }),
    phrase(5, 50, '也则是照独眠', { status: 'inferred', evidence: ['语义：完整分句'] }),
  ]
  return {
    meta: { title: '寻梦', performer: '', source: '', video: '', span: [10, 60] },
    lines: phrases,
    phrases,
    breaths: [],
    tracks: [],
    sections: [
      { key: 's01', qupai: '懒画眉', kind: '唱', phrase_ids: ['p001', 'p002'] },
      { key: 's02', qupai: null, kind: '白', phrase_ids: ['p003'] },
      { key: 's03', qupai: null, kind: '唱', phrase_ids: ['p004', 'p005'] },
    ],
  }
}
