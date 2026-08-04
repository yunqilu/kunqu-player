const COLORS = { inferred: '#D97706', qiangge: '#15803D', playback: '#7E22CE', unresolved: '#B91C1C' }
const escapeXml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const valueOf = (rational) => rational.numerator / rational.denominator
const gcd = (left, right) => right ? gcd(right, left % right) : Math.abs(left)
const lcm = (left, right) => Math.abs(left * right) / gcd(left, right)

function divisionsFor(section) {
  return Math.min(1024, section.events.reduce((value, event) => lcm(value, event.duration?.value?.denominator || 1), 1))
}

function durationNotation(value, sideNote = false) {
  const values = [
    [4, 'whole', 0], [3, 'half', 1], [2, 'half', 0], [1.5, 'quarter', 1], [1, 'quarter', 0],
    [0.75, 'eighth', 1], [0.5, 'eighth', 0], [0.375, '16th', 1], [0.25, '16th', 0],
    [0.125, '32nd', 0], [0.0625, '64th', 0],
  ]
  const match = values.find(([duration]) => Math.abs(duration - value) < 1e-9) || [value, 'quarter', 0]
  return `<type${sideNote ? ' size="cue"' : ''}>${match[1]}</type>${'<dot/>'.repeat(match[2])}`
}

function noteXml(event, divisions) {
  const inferred = [event.absolutePitch, event.onset, event.duration].some((field) => field?.status === 'inferred')
  const color = inferred ? ` color="${COLORS.inferred}"` : ''
  const durationValue = valueOf(event.duration.value)
  const duration = Math.round(durationValue * divisions)
  const editorial = inferred ? '<level reference="yes">inferred:pitch,duration</level>' : ''
  if (event.kind === 'rest') {
    return `<note id="${escapeXml(event.id)}"${color}><rest/><duration>${duration}</duration>${durationNotation(durationValue)}<notations>${editorial}</notations></note>`
  }
  const pitch = event.absolutePitch.value
  const alter = pitch.alter ? `<alter>${pitch.alter}</alter>` : ''
  const lyric = event.lyric?.role === 'main'
    ? `<lyric><syllabic>single</syllabic><text>${escapeXml(event.lyric.text)}</text></lyric>`
    : event.lyric ? '<lyric><extend/></lyric>' : ''
  const breath = event.breathAfter ? '<articulations><breath-mark/></articulations>' : ''
  const qianggeNames = [...new Set((event.qiangge || []).map((item) => item.name))]
  const qiangge = qianggeNames.length
    ? `<ornaments>${qianggeNames.map((name) => `<other-ornament color="${COLORS.qiangge}">${escapeXml(name)}</other-ornament>`).join('')}</ornaments>`
    : ''
  const tieSound = `${event.tie?.stop ? '<tie type="stop"/>' : ''}${event.tie?.start ? '<tie type="start"/>' : ''}`
  const tieNotation = `${event.tie?.stop ? '<tied type="stop"/>' : ''}${event.tie?.start ? '<tied type="start"/>' : ''}`
  return `<note id="${escapeXml(event.id)}"${color}><pitch><step>${pitch.step}</step>${alter}<octave>${pitch.octave}</octave></pitch>${tieSound}<duration>${duration}</duration>${durationNotation(durationValue, event.sideNote)}<notations>${editorial}${tieNotation}${breath}${qiangge}</notations>${lyric}</note>`
}

export function exportMusicXml(canonicalScore, playbackMarkers = []) {
  let globalMeasure = 0
  const measures = canonicalScore.sections.flatMap((section) => {
    const divisions = divisionsFor(section)
    return section.measures.map((measure, localIndex) => {
    globalMeasure += 1
    const attributes = localIndex === 0
      ? section.meter.value.senzaMisura
        ? `<attributes><divisions>${divisions}</divisions><time><senza-misura/></time><clef><sign>G</sign><line>2</line></clef></attributes><direction><direction-type><words color="#D97706">散板；时值仅供排谱</words></direction-type></direction>`
        : `<attributes><divisions>${divisions}</divisions><time><beats>${section.meter.value.beats}</beats><beat-type>${section.meter.value.beatType}</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`
      : ''
    const legend = globalMeasure === 1 ? '<direction><direction-type><words>黑=谱面/确定推导；橙=推定；绿=明记腔格；紫=播放效果</words></direction-type></direction>' : ''
    const inference = section.events.some((event) => event.measureIndex === localIndex && event.colorRole === 'inferred')
      ? '<direction><direction-type><words color="#D97706">推:调/时</words></direction-type></direction>'
      : ''
    const markerXml = playbackMarkers.filter((marker) => marker.sectionId === section.id && (marker.measureIndex ?? 0) === localIndex)
      .map((marker) => `<direction id="${escapeXml(marker.id)}"><direction-type><words color="${COLORS.playback}">${escapeXml(marker.text)}</words></direction-type></direction>`).join('')
    const textXml = localIndex === 0 ? (section.textEvents || []).map((event) => {
      const unresolved = event.classification === 'unresolved'
      const label = event.classification === 'speech' ? `白：${event.text}` : unresolved ? `待校文字：${event.text}` : event.text
      return `<direction id="${escapeXml(event.id)}"><direction-type><words${unresolved ? ` color="${COLORS.inferred}"` : ''}>${escapeXml(label)}</words></direction-type></direction>`
    }).join('') : ''
    const events = section.events.filter((event) => event.measureIndex === localIndex).map((event) => noteXml(event, divisions)).join('')
      return `<measure number="${globalMeasure}">${attributes}${legend}${inference}${textXml}${markerXml}${events}</measure>`
    })
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="4.0"><identification><encoding><software>kunqu-player</software></encoding></identification><part-list><score-part id="P1"><part-name>唱腔</part-name></score-part></part-list><part id="P1">${measures.join('')}</part></score-partwise>`
}
