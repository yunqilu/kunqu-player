import { diagnostic } from '../diagnostics.js'
import { evidence } from '../evidence.js'
import { stableId } from '../ids.js'

function fraction(numerator, denominator) {
  return { numerator, denominator }
}

function numberOf(field) {
  return field.value.numerator / field.value.denominator
}

function fromNumber(value) {
  const quarters = Math.round(value * 4)
  const divisor = quarters % 4 === 0 ? 4 : quarters % 2 === 0 ? 2 : 1
  return { numerator: quarters / divisor, denominator: 4 / divisor }
}

export function realizeQiangge(section, pitchedEvents, diagnostics) {
  const realized = []
  for (let index = 0; index < pitchedEvents.length; index += 1) {
    const event = pitchedEvents[index]
    realized.push(event)

    const dieCodes = event.qiangge.filter((item) => item.code === 'd')
    dieCodes.forEach((code, repeatIndex) => {
      const realizationId = stableId('real', event.id, 'die', repeatIndex)
      realized.push({
        ...structuredClone(event),
        id: stableId(event.id, 'die', repeatIndex + 1),
        sourceEventIds: [event.id],
        sourceRef: code.sourceRef,
        lyric: { text: event.lyric?.text || '', role: 'extension' },
        qiangge: [],
        anchors: [],
        breathAfter: false,
        realizationId,
        realizationRole: 'repeat',
        realizationStatus: 'derived',
      })
    })

    const duoCodes = event.qiangge.filter((item) => item.code === 'c')
    if (duoCodes.length > 1) {
      diagnostics.push(diagnostic('DUPLICATE_DUOQIANG_CODE', 'error', '同一前音后的多个掇腔码只实现第一枚', {
        sourceRef: duoCodes[1].sourceRef,
        eventIds: [event.id],
      }))
    }
    if (duoCodes.length === 0) continue
    const trailing = pitchedEvents[index + 1]
    const realizationId = stableId('real', event.id, 'duo')
    event.realizationId = realizationId
    event.realizationRole = 'stop'
    if (!trailing) {
      event.realizationStatus = 'unresolved'
      diagnostics.push(diagnostic('DUOQIANG_MISSING_TRAILING_NOTE', 'error', '掇腔后没有同曲牌同乐句内的谱面音', {
        sourceRef: duoCodes[0].sourceRef,
        eventIds: [event.id],
      }))
      continue
    }

    event.realizationStatus = 'derived'
    trailing.realizationId = realizationId
    trailing.realizationRole = 'carry'
    trailing.realizationStatus = 'derived'
    if (trailing.sourceRef.lineId !== event.sourceRef.lineId || trailing.sourceRef.charIndex !== event.sourceRef.charIndex) {
      const displacedLyric = trailing.lyric
      trailing.lyric = { text: event.lyric?.text || '', role: 'extension' }
      const replacement = pitchedEvents.slice(index + 2).find((candidate) =>
        candidate.sourceRef.lineId === trailing.sourceRef.lineId &&
        candidate.sourceRef.charIndex === trailing.sourceRef.charIndex &&
        candidate.realizationRole !== 'carry')
      if (replacement) replacement.lyric = displacedLyric
      else diagnostics.push(diagnostic('DUOQIANG_LYRIC_COLLISION', 'error', '掇腔带音占用了后一唱词且该字没有剩余主音', {
        sourceRef: trailing.sourceRef,
        eventIds: [event.id, trailing.id],
      }))
    }
    realized.push({
      id: stableId('rest', realizationId),
      kind: 'rest',
      sourceEventIds: [event.id, trailing.id],
      sourceRef: duoCodes[0].sourceRef,
      restOrigin: 'qiangge',
      relativePitch: null,
      absolutePitch: null,
      lyric: null,
      sideNote: false,
      anchors: [],
      breathAfter: false,
      qiangge: [],
      onset: null,
      duration: null,
      realizationId,
      realizationRole: 'rest',
      realizationStatus: 'derived',
    })
  }

  // Construction order is score order: source note, its repetitions/rest, then the next written note.
  return realized
}

export function applyQianggeTiming(section, rhythm, diagnostics) {
  const byRealization = new Map()
  for (const event of rhythm.events) {
    if (event.realizationId && ['stop', 'rest', 'carry'].includes(event.realizationRole)) {
      const group = byRealization.get(event.realizationId) || {}
      group[event.realizationRole] = event
      byRealization.set(event.realizationId, group)
    }
  }
  for (const group of byRealization.values()) {
    if (!group.stop || !group.rest || !group.carry) continue
    const start = numberOf(group.stop.onset)
    const explicitCarryAnchor = group.carry.anchors?.length > 0
    const carryOnset = numberOf(group.carry.onset)
    if (explicitCarryAnchor && carryOnset <= start) {
      rhythm.events = rhythm.events.filter((event) => event.id !== group.rest.id)
      group.stop.realizationStatus = 'unresolved'
      group.carry.realizationStatus = 'unresolved'
      diagnostics.push(diagnostic('DUOQIANG_NO_METRIC_SPACE', 'error', '板眼锚点间没有容纳正时值掇腔休止的空间', { eventIds: [group.stop.id, group.carry.id] }))
      continue
    }
    let stopDuration = 0.5
    let restDuration = 0.25
    let carryDuration = 0.25
    let status = group.stop.duration.status === 'derived' && group.carry.duration.status === 'derived' ? 'derived' : 'inferred'
    if (explicitCarryAnchor && Math.abs(carryOnset - (start + 0.75)) > 1e-9) {
      const span = carryOnset - start
      stopDuration = span * 2 / 3
      restDuration = span / 3
      carryDuration = span / 3
      status = 'inferred'
      diagnostics.push(diagnostic('DUOQIANG_ANCHOR_CONFLICT', 'error', '明记板眼优先，掇腔具体时值已标为推定', { eventIds: [group.stop.id, group.carry.id] }))
    }
    const rule = status === 'derived' ? 'duoqiang-stop-rest-carry-v1' : 'duoqiang-timing-inferred-v1'
    group.stop.onset = evidence(fromNumber(start), status, rule)
    group.stop.duration = evidence(fromNumber(stopDuration), status, rule)
    group.rest.onset = evidence(fromNumber(start + stopDuration), status, rule)
    group.rest.duration = evidence(fromNumber(restDuration), status, rule)
    group.carry.onset = evidence(fromNumber(explicitCarryAnchor ? carryOnset : start + stopDuration + restDuration), status, rule)
    group.carry.duration = evidence(fromNumber(carryDuration), status, rule)
    for (const event of [group.stop, group.rest, group.carry]) {
      event.measureIndex = rhythm.meter.value.senzaMisura ? 0 : Math.floor(numberOf(event.onset) / rhythm.meter.value.beats)
      event.colorRole = status === 'inferred' || event.absolutePitch?.status === 'inferred' ? 'inferred' : 'normal'
    }
  }
  if (rhythm.meter.value.senzaMisura) {
    let cursor = 0
    for (const event of rhythm.events) {
      const status = event.onset.status
      event.onset = evidence(fromNumber(cursor), status, event.onset.ruleId || 'sanban-engraving-duration-v1')
      event.measureIndex = 0
      cursor += numberOf(event.duration)
    }
    rhythm.measures = [{ number: 1, duration: fromNumber(cursor), senzaMisura: true }]
  }
  return rhythm
}
