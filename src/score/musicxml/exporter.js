import { stableId } from '../ids.js'
import { diagnostic } from '../diagnostics.js'
import { lcm, valueOf } from '../rational.js'

const COLORS = { inferred: '#D97706', qiangge: '#15803D', playback: '#7E22CE', unresolved: '#B91C1C' }
const escapeXml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
function divisionsFor(section, diagnostics) {
  const required = section.events.reduce((value, event) =>
    lcm(lcm(value, event.duration?.value?.denominator || 1), event.onset?.value?.denominator || 1), 1)
  if (required > 1024) {
    diagnostics.push(diagnostic('MUSICXML_DURATION_OVERFLOW', 'warning', `区段 ${section.id} 需要 divisions=${required}；为避免舍入已保留精确值`, {
      suggestedAction: '人工复核该区段的复杂时值或改用 tuplet 表达',
    }))
  }
  return required
}

function durationNotation(rational, sideNote = false) {
  const value = valueOf(rational)
  const values = [
    [4, 'whole', 0], [3, 'half', 1], [2, 'half', 0], [1.5, 'quarter', 1], [1, 'quarter', 0],
    [0.75, 'eighth', 1], [0.5, 'eighth', 0], [0.375, '16th', 1], [0.25, '16th', 0],
    [0.125, '32nd', 0], [0.0625, '64th', 0],
  ]
  const match = values.find(([duration]) => Math.abs(duration - value) < 1e-9)
  if (match) return `<type${sideNote ? ' size="cue"' : ''}>${match[1]}</type>${'<dot/>'.repeat(match[2])}`
  return `<type${sideNote ? ' size="cue"' : ''}>quarter</type><time-modification><actual-notes>${rational.denominator}</actual-notes><normal-notes>${rational.numerator}</normal-notes></time-modification>`
}

function noteXml(event, divisions) {
  const inferredFields = ['absolutePitch', 'onset', 'duration'].filter((key) => event[key]?.status === 'inferred')
    .map((key) => key === 'absolutePitch' ? 'pitch' : key)
  const inferred = inferredFields.length > 0
  const color = inferred ? ` color="${COLORS.inferred}"` : ''
  const durationValue = valueOf(event.duration.value)
  const duration = Math.round(durationValue * divisions)
  const editorial = inferred ? `<level reference="yes">inferred:${inferredFields.join(',')}</level>` : ''
  const notations = (content) => content ? `<notations>${content}</notations>` : ''
  if (event.kind === 'rest') {
    return `<note id="${escapeXml(event.id)}"${color}><rest/><duration>${duration}</duration>${durationNotation(event.duration.value)}${notations(editorial)}</note>`
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
  return `<note id="${escapeXml(event.id)}"${color}><pitch><step>${pitch.step}</step>${alter}<octave>${pitch.octave}</octave></pitch>${tieSound}<duration>${duration}</duration>${durationNotation(event.duration.value, event.sideNote)}${notations(`${editorial}${tieNotation}${breath}${qiangge}`)}${lyric}</note>`
}

function measureEventsXml(section, localIndex, divisions, diagnostics) {
  const capacity = section.meter.value.senzaMisura
    ? null
    : section.meter.value.beats * 4 / section.meter.value.beatType
  const measureStart = capacity == null ? 0 : localIndex * capacity
  let cursor = measureStart
  let xml = ''
  const events = section.events.filter((event) => event.measureIndex === localIndex)
    .sort((left, right) => valueOf(left.onset) - valueOf(right.onset) || left.id.localeCompare(right.id))
  for (const event of events) {
    const onset = valueOf(event.onset)
    if (onset > cursor + 1e-9) {
      const gap = Math.round((onset - cursor) * divisions)
      xml += `<forward><duration>${gap}</duration></forward>`
    } else if (onset < cursor - 1e-9) {
      const overlap = Math.round((cursor - onset) * divisions)
      xml += `<backup><duration>${overlap}</duration></backup>`
      diagnostics.push(diagnostic('MUSICXML_UNREPRESENTABLE_EVENT', 'error', '事件拍位与前一事件重叠；已用 backup 保留 canonical onset，请人工复核声部', {
        sourceRef: event.sourceRef, eventIds: [event.id], fieldPath: 'onset',
      }))
    }
    xml += noteXml(event, divisions)
    cursor = onset + valueOf(event.duration)
  }
  if (capacity != null) {
    const measureEnd = measureStart + capacity
    if (cursor < measureEnd - 1e-9) xml += `<forward><duration>${Math.round((measureEnd - cursor) * divisions)}</duration></forward>`
  }
  return xml
}

export function exportMusicXml(canonicalScore, playbackMarkers = [], diagnostics = canonicalScore.diagnostics || []) {
  let globalMeasure = 0
  const measures = canonicalScore.sections.flatMap((section) => {
    const divisions = divisionsFor(section, diagnostics)
    return section.measures.map((measure, localIndex) => {
    globalMeasure += 1
    const attributes = localIndex === 0
      ? section.meter.value.senzaMisura
        ? `<attributes><divisions>${divisions}</divisions><time><senza-misura/></time><clef><sign>G</sign><line>2</line></clef></attributes><direction id="${stableId('dir', section.id, 'sanban')}"><direction-type><words color="#D97706">${section.meter.value.unresolvedMeter ? '板式未定' : '散板'}；时值仅供排谱</words></direction-type></direction>`
        : `<attributes><divisions>${divisions}</divisions><time><beats>${section.meter.value.beats}</beats><beat-type>${section.meter.value.beatType}</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`
      : ''
    const legend = globalMeasure === 1 ? '<direction id="dir_inference_legend"><direction-type><words>黑=谱面/确定推导；橙=推定；绿=明记腔格；紫=播放效果</words></direction-type></direction>' : ''
    const inference = section.events.some((event) => event.measureIndex === localIndex && event.colorRole === 'inferred')
      ? `<direction id="${stableId('dir', section.id, localIndex, 'inference')}"><direction-type><words color="#D97706">推:调/时</words></direction-type></direction>`
      : ''
    const markerXml = playbackMarkers.filter((marker) => marker.sectionId === section.id && (marker.measureIndex ?? 0) === localIndex)
      .map((marker) => {
        const offset = Math.round(valueOf(marker.beatOffset || { numerator: 0, denominator: 1 }) * divisions)
        return `<direction id="${escapeXml(marker.id)}"><direction-type><words color="${COLORS.playback}">${escapeXml(marker.text)}</words></direction-type>${offset ? `<offset sound="no">${offset}</offset>` : ''}</direction>`
      }).join('')
    const textXml = localIndex === 0 ? (section.textEvents || []).map((event) => {
      const needsReview = event.classification === 'unresolved' || event.classification === 'lyric-collision'
      const label = event.classification === 'speech' ? `白：${event.text}` : needsReview ? `待校文字：${event.text}` : event.text
      return `<direction id="${escapeXml(event.id)}"><direction-type><words${needsReview ? ` color="${COLORS.inferred}"` : ''}>${escapeXml(label)}</words></direction-type></direction>`
    }).join('') : ''
    const events = measureEventsXml(section, localIndex, divisions, diagnostics)
      return `<measure number="${globalMeasure}">${attributes}${legend}${inference}${textXml}${markerXml}${events}</measure>`
    })
  })
  const title = canonicalScore.meta?.title ? `<work><work-title>${escapeXml(canonicalScore.meta.title)}</work-title></work>` : ''
  const source = canonicalScore.sources?.length ? `<source>${escapeXml(canonicalScore.sources.map((item) => `${item.title}${item.url ? ` ${item.url}` : ''}`).join('；'))}</source>` : ''
  return `<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="4.0">${title}<identification><encoding><software>kunqu-player</software></encoding>${source}</identification><part-list><score-part id="P1"><part-name>唱腔</part-name></score-part></part-list><part id="P1">${measures.join('')}</part></score-partwise>`
}
