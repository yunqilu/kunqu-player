// English interface copy. Keys must match zh.js exactly (checked by tests/i18n.test.js).
// Lyrics, movement names and gongche symbols are never translated and do not belong here.
export default {
  'app.title': 'Kunqu Vocal Annotation Player · Seeking the Dream',

  'header.title': 'The Peony Pavilion · Seeking the Dream',
  'header.subtitle': 'Gu Weiying · CCTV broadcast · vocal annotation · {n} phrases',
  'header.seal': 'Seeking the Dream',
  'header.urlPlaceholder': 'Direct video URL (https://…/video.mp4)',
  'header.load': 'Load',
  'header.localFile': 'Local file',
  'header.changeVideo': 'Change video',
  'header.language': 'Interface language',

  'video.loading': 'Loading video…',
  'video.missing': 'No video found at media/xunmeng.mp4. Put the file there and reload, or load one from a URL or a local file.',
  'video.failed': 'This video could not be played. Try another URL or a local file.',
  'video.virtual': 'Without a video you can still press ▶ or Space to preview the sync on a virtual timeline.',

  'review.drawer': 'Staff score review',

  'left.outlineTitle': 'Qupai · phrases · click to jump',
  'left.phraseOne': '{n} phrase',
  'left.phraseMany': '{n} phrases',
  'left.inferredCount': ' · {n} inferred',
  'left.variantMark': 'var',

  'kind.sung': 'Sung',
  'kind.spoken': 'Spoken',

  'status.confirmed': 'From lyrics',
  'status.variant': 'Variant wording',
  'status.inferred': 'Inferred',

  'outline.tipInferred': 'Inferred phrase break. Evidence:',
  'outline.tipVariant': 'Differs from the libretto:',

  // Evidence: codes match TEMPLATES_ZH in backend/app/evidence.py. Quoted lyrics stay Chinese.
  'evidence.lyric_punct': 'Break from the libretto: the clause ends with "{punct}"',
  'evidence.lyric_boundary': 'Break from the libretto: the clause ends at a qupai title, role marker or stage direction',
  'evidence.variant': 'Performed "{performed}"; the libretto has "{lyric}"',
  'evidence.dropped': 'Libretto "{text}" was not sung (libretto clause: "{clause}")',
  'evidence.attached_no_prev': '"{ch}" is not in the libretto; no aligned character comes before it, so it joins the next phrase',
  'evidence.attached_same_clause': '"{ch}" is not in the libretto; the characters before and after it belong to this phrase',
  'evidence.attached_group_next': '"{ch}" is not in the libretto; the source data groups it with the following "{neighbor}" in {line_id}, so it joins the next phrase',
  'evidence.attached_group_prev': '"{ch}" is not in the libretto; the source data groups it with the preceding "{neighbor}" in {line_id}, so it joins the previous phrase',
  'evidence.attached_gap_next': '"{ch}" is not in the libretto; it comes {before} s after the previous character and {after} s before the next, so it joins the next phrase',
  'evidence.attached_gap_prev': '"{ch}" is not in the libretto; it comes {before} s after the previous character and {after} s before the next, so it joins the previous phrase',
  'evidence.override_note': '{en}',
  'evidence.gap': 'Pause of {seconds} s after the phrase',
  'evidence.breath': 'A breath point falls in the pause',
  'evidence.gap_excluded': 'The pause contains the excluded "{ch}" ({s}–{e} s)',

  'flow.title': 'Duration layout',
  'flow.hint': 'One phrase per row · width follows duration · click anything to jump',
  'flow.charVariant': 'Performed "{ch}"; the libretto has "{lyric}"',
  'flow.charAttached': '"{ch}" is not in the libretto (padding syllable)',
  'flow.charPlain': '{ch} · {style}',
  'flow.excluded': 'Excluded "{ch}" ({from}–{to}): {reason}',
  'flow.provisional': '{label} (provisional track)',
  'flow.breathAt': 'Breath {time}',

  'track.gongche': 'Gongche',
  'track.qiangge': 'Ornaments',
  'track.breath': 'Breath',
  'track.action': 'Movement',

  'style.sung': 'sung',
  'style.speech': 'speech-like delivery',

  'reader.breath': '⌇ breath',
  'reader.spoken': 'spoken',
  'reader.prelude': 'Prelude / interlude',

  'transport.back5': 'Back 5 seconds',
  'transport.forward5': 'Forward 5 seconds',
  'transport.playPause': 'Play / pause (Space)',
  'transport.loop': 'Loop phrase',
  'transport.timeline': 'Timeline',

  'timeline.title': 'Multi-track timeline (read-only)',
  'timeline.zoom': 'Zoom',
  'timeline.hint': 'Click a block or point to jump · double-click empty space to seek',
  'timeline.textLane': 'Text',

  'error.unreachable': 'Cannot reach the backend ({url}). Run make up first.',
  'error.notFound': 'The backend has no such piece ({url}).',
  'error.server': 'The backend failed to compute the phrasing (HTTP {status}). Check its log with make logs.',
  'error.http': 'The backend returned {status} ({url}). Check its log with make logs.',
}
