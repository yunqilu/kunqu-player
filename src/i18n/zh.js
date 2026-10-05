// 中文界面文案。key 必须与 en.js 完全一致（tests/i18n.test.js 会检查）。
export default {
  'app.title': '昆曲声腔标注播放器 · 寻梦',

  'header.title': '寻梦（牡丹亭）',
  'header.subtitle': '{performer}　{source}　声腔标注 · {n} 句',
  'header.seal': '寻梦',
  'header.urlPlaceholder': '视频直链 URL（https://…/寻梦.mp4）',
  'header.load': '载入',
  'header.localFile': '本地',
  'header.changeVideo': '更换视频',
  'header.language': '界面语言',

  'video.loading': '正在载入视频…',
  'video.missing': '没有在 media/xunmeng.mp4 找到视频。把文件放到那里再刷新，或者输入直链、选本地文件。',
  'video.failed': '这个视频无法播放。请换一个直链或本地文件。',
  'video.virtual': '未载入时仍可按 ▶ / 空格 用「虚拟时间轴」预览同步',

  'header.subtitles': '英文字幕',
  'subtitle.draft': '初稿',
  'subtitle.draftTip': '翻译初稿，尚未审阅',

  'review.drawer': '五线谱审阅',

  'left.outlineTitle': '曲牌 · 分句 · 点击跳转',
  'left.phraseOne': '{n} 句',
  'left.phraseMany': '{n} 句',
  'left.inferredCount': ' · 推定 {n}',
  'left.variantMark': '异',

  'kind.sung': '唱',
  'kind.spoken': '白',

  'status.confirmed': '依歌词',
  'status.variant': '与歌词有出入',
  'status.inferred': '推定',

  'outline.tipInferred': '推定断句，依据：',
  'outline.tipVariant': '与歌词不同：',

  // 依据：code 与后端 backend/app/evidence.py 的 TEMPLATES_ZH 一致，中文文本也必须相同
  'evidence.lyric_punct': '歌词断句：句末标点「{punct}」',
  'evidence.lyric_boundary': '歌词断句：句末为曲牌、角色标记或舞台提示',
  'evidence.variant': '演出「{performed}」，歌词作「{lyric}」',
  'evidence.dropped': '歌词「{text}」未唱（歌词原句：{clause}）',
  'evidence.attached_no_prev': '「{ch}」不在歌词中，其前没有已对齐的字，归入后一句',
  'evidence.attached_same_clause': '「{ch}」不在歌词中，前后的字同属本句',
  'evidence.attached_group_next': '「{ch}」不在歌词中，原数据中与后字「{neighbor}」同属 {line_id}，归入后一句',
  'evidence.attached_group_prev': '「{ch}」不在歌词中，原数据中与前字「{neighbor}」同属 {line_id}，归入前一句',
  'evidence.attached_gap_next': '「{ch}」不在歌词中，距前字 {before} 秒、距后字 {after} 秒，归入后一句',
  'evidence.attached_gap_prev': '「{ch}」不在歌词中，距前字 {before} 秒、距后字 {after} 秒，归入前一句',
  'evidence.override_note': '{zh}',
  'evidence.gap': '句后停顿 {seconds} 秒',
  'evidence.breath': '停顿处有呼吸点',
  'evidence.gap_excluded': '停顿中包含已排除的「{ch}」（{s}–{e} 秒）',

  'flow.title': '时长排版',
  'flow.hint': '一句一行 · 字宽随时长 · 点任意单元跳转',
  'flow.charVariant': '演出「{ch}」，歌词作「{lyric}」',
  'flow.charAttached': '「{ch}」不在歌词中（衬字）',
  'flow.charPlain': '{ch} · {style}',
  'flow.excluded': '已排除的「{ch}」（{from}–{to}）：{reason}',
  'flow.provisional': '{label}（临时轨）',
  'flow.breathAt': '呼吸 {time}',

  'track.gongche': '工尺',
  'track.qiangge': '腔格',
  'track.breath': '呼吸',
  'track.action': '动作',

  'style.sung': '普通唱',
  'style.speech': '念白式',

  'reader.breath': '⌇ 呼吸',
  'reader.spoken': '白',
  'reader.prelude': '（前奏 · 过门）',

  'transport.back5': '后退 5 秒',
  'transport.forward5': '前进 5 秒',
  'transport.playPause': '播放/暂停 (空格)',
  'transport.loop': '循环本句',
  'transport.timeline': '时间轴',

  'timeline.title': '多轨时间轴（只读）',
  'timeline.zoom': '缩放',
  'timeline.hint': '点击区块 / 打点跳转 · 双击空白处定位',
  'timeline.textLane': '字',

  'error.unreachable': '连不上后端（{url}）。请先运行 make up。',
  'error.notFound': '后端没有这个曲目（{url}）。',
  'error.server': '后端断句失败（HTTP {status}）。请用 make logs 查看后端日志。',
  'error.http': '后端返回 {status}（{url}）。请用 make logs 查看后端日志。',
}
