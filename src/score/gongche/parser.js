import { diagnostic } from '../diagnostics.js'
import { evidence } from '../evidence.js'
import { stableId } from '../ids.js'
import { relativePitch } from './pitch.js'

const BASES = new Set(['合', '四', '一', '上', '尺', '工', '凡', '六', '五', '乙'])
const QIANGGE = {
  h: { code: 'h', kind: 'huo', name: '豁腔' },
  s: { code: 's', kind: 'sou', name: '擞腔' },
  d: { code: 'd', kind: 'die', name: '叠腔' },
  c: { code: 'c', kind: 'duo', name: '掇腔' },
}
const OPEN = new Set(['（', '('])
const CLOSE = new Set(['）', ')'])
const SEPARATOR = /\s|[、，,;]/u

function sourceRef(symbol, rawStart, rawEnd) {
  return { ...symbol.sourceRef, rawStart, rawEnd }
}

function compareFlattened(symbol, parsed, diagnostics) {
  if (!symbol.flattened || Object.values(symbol.flattened).every((value) => value == null)) return
  const actual = {
    b: parsed.notes[0]?.base ?? null,
    r: parsed.notes[0]?.register ?? 0,
    p: parsed.notes[0]?.sideNote ?? false,
    bt: parsed.notes.flatMap((note) => note.anchors.map((anchor) => anchor.code)).join(''),
    o: parsed.notes.flatMap((note) => note.qiangge.map((item) => item.code)).join(''),
    q: parsed.notes.some((note) => note.breathAfter),
  }
  const mismatch = Object.keys(actual).some((key) => symbol.flattened[key] !== actual[key])
  if (mismatch) {
    diagnostics.push(diagnostic(
      'FLATTENED_FIELD_MISMATCH',
      'warning',
      '展开字段与 gc.raw 解析结果不一致；已采用 gc.raw',
      { sourceRef: symbol.sourceRef, suggestedAction: '重新生成播放投影的展开字段' },
    ))
  }
}

function isAtOrAfter(ref, boundary, lineOrder) {
  if (!boundary) return true
  const refLine = lineOrder.get(ref.lineId) ?? -1
  const boundaryLine = lineOrder.get(boundary.lineId) ?? -1
  return refLine > boundaryLine || refLine === boundaryLine && ref.charIndex >= (boundary.charIndex ?? 0)
}

function isAtOrBefore(ref, boundary, lineOrder) {
  if (!boundary) return true
  const refLine = lineOrder.get(ref.lineId) ?? Number.MAX_SAFE_INTEGER
  const boundaryLine = lineOrder.get(boundary.lineId) ?? Number.MAX_SAFE_INTEGER
  return refLine < boundaryLine || refLine === boundaryLine && ref.charIndex <= (boundary.charIndex ?? Number.MAX_SAFE_INTEGER)
}

export function parseReviewedSource(reviewedSource, diagnostics) {
  const events = []
  const textEvents = []
  const lineOrder = new Map(reviewedSource.lines.map((line, index) => [line.id, index]))
  const classifications = new Map(reviewedSource.textClassifications.map((item) => [`${item.target.lineId}:${item.target.charIndex}`, item]))

  for (const line of reviewedSource.lines) {
    for (const char of line.chars) {
      if (char.gc.length === 0) {
        const classification = classifications.get(`${line.id}:${char.sourceRef.charIndex}`)
        textEvents.push({
          id: stableId('text', reviewedSource.scoreId, line.id, char.sourceRef.charIndex),
          kind: 'text',
          text: char.ch,
          sourceRef: char.sourceRef,
          classification: classification?.kind || 'unresolved',
          evidenceStatus: classification?.status || 'unresolved',
          ruleId: classification?.ruleId || null,
        })
        if (!classification || classification.kind === 'unresolved') {
          diagnostics.push(diagnostic('TEXT_EVENT_UNRESOLVED', 'warning', `无工尺文字“${char.ch}”尚未解决`, { sourceRef: char.sourceRef }))
        }
      }
      let lyricUsed = false
      let sideDepth = 0
      let currentEvent = null
      let parserLocalIndex = 0

      for (const symbol of char.gc) {
        const parsedToken = { notes: [] }
        const raw = symbol.raw || ''
        for (let cursor = 0; cursor < raw.length;) {
          const token = raw[cursor]
          if (OPEN.has(token)) { sideDepth += 1; cursor += 1; continue }
          if (CLOSE.has(token)) {
            if (sideDepth === 0) {
              diagnostics.push(diagnostic('UNBALANCED_SIDE_NOTE_RANGE', 'fatal', '旁注音右括号没有对应左括号', { sourceRef: sourceRef(symbol, cursor, cursor + 1) }))
            } else sideDepth -= 1
            cursor += 1
            continue
          }
          if (BASES.has(token)) {
            const start = cursor
            cursor += 1
            let register = 0
            if (raw[cursor] === '+' || raw[cursor] === '-') register = raw[cursor++] === '+' ? 1 : -1
            if (raw[cursor] === '+' || raw[cursor] === '-') {
              diagnostics.push(diagnostic('ILLEGAL_REGISTER_COMBINATION', 'fatal', '工尺音区标记组合不合法', { sourceRef: sourceRef(symbol, start, cursor + 1) }))
            }
            const relative = relativePitch(token, register)
            const id = stableId('evt', reviewedSource.scoreId, line.id, char.sourceRef.charIndex, symbol.correctionId || 'source', symbol.sourceRef.gongcheIndex, parserLocalIndex)
            currentEvent = {
              id,
              sourceEventIds: [id],
              kind: 'note',
              sourceRef: sourceRef(symbol, start, cursor),
              gongcheRaw: raw,
              base: token,
              register,
              lyric: lyricUsed ? { text: char.ch, role: 'extension' } : { text: char.ch, role: 'main' },
              lyricEvidence: evidence(lyricUsed ? { text: char.ch, role: 'extension' } : { text: char.ch, role: 'main' }, 'derived', 'gongche-lyric-attachment-v1'),
              lyricTone: char.tone || null,
              relativePitch: evidence(relative, 'derived', 'gongche-base-register-v1'),
              absolutePitch: null,
              sideNote: sideDepth > 0,
              anchors: [],
              breathAfter: false,
              qiangge: [],
              onset: null,
              duration: null,
            }
            events.push(currentEvent)
            parsedToken.notes.push(currentEvent)
            lyricUsed = true
            parserLocalIndex += 1
            continue
          }
          if (/^[1-8]$/.test(token) && currentEvent) {
            currentEvent.anchors.push({ code: token, sourceRef: sourceRef(symbol, cursor, cursor + 1) })
            cursor += 1
            continue
          }
          if (token === '/' && currentEvent) {
            currentEvent.breathAfter = true
            cursor += 1
            continue
          }
          if (QIANGGE[token] && currentEvent) {
            currentEvent.qiangge.push({ ...QIANGGE[token], sourceRef: sourceRef(symbol, cursor, cursor + 1) })
            cursor += 1
            continue
          }
          if (SEPARATOR.test(token)) { cursor += 1; continue }
          diagnostics.push(diagnostic('UNKNOWN_GONGCHE_CHARACTER', 'fatal', `未知工尺字符：${token}`, {
            sourceRef: sourceRef(symbol, cursor, cursor + 1),
            suggestedAction: '在校订清单中修订 gc.raw 或登记该记号',
          }))
          cursor += 1
        }
        compareFlattened(symbol, parsedToken, diagnostics)
      }

      if (sideDepth !== 0) {
        const last = char.gc.at(-1)
        diagnostics.push(diagnostic('UNBALANCED_SIDE_NOTE_RANGE', 'fatal', '旁注音括号未闭合', {
          sourceRef: last ? sourceRef(last, last.raw.length, last.raw.length) : char.sourceRef,
        }))
      }
    }
  }

  const declaredSections = reviewedSource.sections.length > 0
    ? reviewedSource.sections
    : [{ id: 'section-default', qupai: null, start: null, end: null }]
  const sections = declaredSections.map((section) => ({
    ...section,
    events: events.filter((event) => isAtOrAfter(event.sourceRef, section.start, lineOrder) && isAtOrBefore(event.sourceRef, section.end, lineOrder)),
    textEvents: textEvents.filter((event) => isAtOrAfter(event.sourceRef, section.start, lineOrder) && isAtOrBefore(event.sourceRef, section.end, lineOrder)),
  }))
  const assigned = new Set(sections.flatMap((section) => section.events.map((event) => event.id)))
  const assignmentCounts = new Map()
  for (const section of sections) for (const event of section.events) assignmentCounts.set(event.id, (assignmentCounts.get(event.id) || 0) + 1)
  const overlaps = [...assignmentCounts].filter(([, count]) => count > 1).map(([id]) => id)
  if (overlaps.length > 0) {
    diagnostics.push(diagnostic('SECTION_GAP_OR_OVERLAP', 'fatal', '曲牌区段相互重叠，同一谱面事件被重复分配', { eventIds: overlaps }))
  }
  if (assigned.size < events.length) {
    diagnostics.push(diagnostic('SECTION_GAP_OR_OVERLAP', 'error', '部分谱面事件未落入任何曲牌区段'))
    sections.push({ id: 'section-unassigned', qupai: null, events: events.filter((event) => !assigned.has(event.id)) })
  }

  return {
    schemaVersion: 1,
    scoreId: reviewedSource.scoreId,
    sourceHash: reviewedSource.sourceHash,
    meta: structuredClone(reviewedSource.meta),
    sources: structuredClone(reviewedSource.sources),
    profileVersions: [reviewedSource.profile],
    sections,
    diagnostics,
    provenanceIndex: Object.fromEntries([...events, ...textEvents].map((event) => [event.id, {
      sourceRef: event.sourceRef,
      fields: event.relativePitch ? { relativePitch: event.relativePitch } : { text: { status: event.evidenceStatus, ruleId: event.ruleId } },
    }])),
  }
}
