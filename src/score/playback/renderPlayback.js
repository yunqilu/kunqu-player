import { sha256, stableId, stableStringify } from '../ids.js'
import { fromNumber } from '../rational.js'

const MARKERS = {
  'qikou-pause': '气口停顿',
  'same-pitch-reattack': '同音换字',
  'phrase-ending': '句尾延长',
  'sanban-timing': '散板时值',
  'melodic-template': '花腔模板',
  'hanqiang-template': '罕腔模板',
  'rusheng-template': '入声模板',
  'huoqiang-realization': '豁腔展开',
  'souqiang-realization': '擞腔展开',
  slide: '滑音',
  vibrato: '振音',
  'qiangge-articulation': '腔格润饰',
}

function numeric(field) {
  return field.value.numerator / field.value.denominator
}

function eventFor(kind, sourceEvents, section, profile, parameters = {}, duration = null, anchor = null) {
  const first = sourceEvents[0]
  const anchorEvent = anchor?.event || first
  const anchorBeat = numeric(anchorEvent.onset) + (anchor?.at === 'end' ? numeric(anchorEvent.duration) : 0)
  const id = stableId('pb', kind, ...sourceEvents.map((event) => event.id))
  const capacity = section.meter.value.senzaMisura ? 0 : section.meter.value.beats * 4 / section.meter.value.beatType
  const measureIndex = capacity
    ? Math.min(Math.floor(anchorBeat / capacity), Math.max(0, section.measures.length - 1))
    : 0
  const beatOffset = anchorBeat - measureIndex * capacity
  return {
    id,
    sourceEventIds: sourceEvents.map((event) => event.id),
    ruleId: `gongchepu-${kind}-v1`,
    profileId: profile.id,
    profileVersion: profile.version,
    sourceImplementationSha256: profile.sourceImplementation.sha256,
    inputHash: sha256(stableStringify({
      kind, profileId: profile.id, profileVersion: profile.version, parameters, duration,
      sourceEvents: sourceEvents.map((event) => ({
        id: event.id, pitch: event.absolutePitch?.value, onset: event.onset?.value, duration: event.duration?.value,
        breathAfter: event.breathAfter, qiangge: event.qiangge?.map((item) => item.code),
      })),
    })),
    evidenceStatus: 'inferred',
    kind,
    beatOnset: fromNumber(anchorBeat),
    beatDuration: duration || first.duration.value,
    parameters,
    scoreMarker: {
      id: stableId('mark', id),
      text: MARKERS[kind],
      colorRole: 'playback',
      sectionId: section.id,
      measureIndex,
      beatOffset: fromNumber(beatOffset),
    },
  }
}

function relativeValue(event, section) {
  return event.absolutePitch.value.midi - section.tuning.value.shangMidi
}

function scaleDistance(value, base) {
  const scale = [0, 2, 4, 7, 9]
  const baseClass = ((base % 12) + 12) % 12
  const valueClass = ((value % 12) + 12) % 12
  const baseIndex = scale.indexOf(baseClass)
  const valueIndex = scale.indexOf(valueClass)
  if (baseIndex < 0 || valueIndex < 0) return null
  return valueIndex - baseIndex + ((baseClass - base - (valueClass - value)) / 12) * scale.length
}

function matchesValues(events, values, section) {
  return events.length >= values.length && values.every((value, index) => relativeValue(events[index], section) === value)
}

function upperNeighborMidi(midi, sevenTone = false) {
  const scale = sevenTone ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 4, 7, 9]
  const pitchClass = ((midi % 12) + 12) % 12
  const index = scale.indexOf(pitchClass)
  if (index < 0) return midi + 1
  const next = scale[(index + 1) % scale.length]
  return midi + ((next - pitchClass + 12) % 12 || 12)
}

function huoqiangNeighborMidi(note) {
  if (note.base === '凡') return note.absolutePitch.value.midi + 4
  if (note.base === '乙') return note.absolutePitch.value.midi + 3
  return upperNeighborMidi(note.absolutePitch.value.midi)
}

function lyricGroups(notes) {
  const groups = []
  for (const note of notes) {
    const key = `${note.sourceRef?.lineId}:${note.sourceRef?.charIndex}`
    const last = groups.at(-1)
    if (!last || last.key !== key) groups.push({ key, notes: [note] })
    else last.notes.push(note)
  }
  return groups
}

function sanbanValues(count, rule) {
  if (count === 1) return [rule.single]
  if (count === 2) return rule.two
  return Array.from({ length: count }, (_, index) => index === count - 1 ? rule.last : rule.fallback)
}

export function renderPlayback(canonicalScore, profile = null) {
  const plan = {
    schemaVersion: 1,
    scoreId: canonicalScore.scoreId,
    canonicalScoreHash: sha256(stableStringify(canonicalScore.sections)),
    profile: profile?.id || null,
    sourceImplementation: profile?.sourceImplementation || null,
    tempoMap: profile ? { beatUnit: 'quarter', defaultBpm: profile.defaultBpm } : null,
    synthesis: profile?.rules?.synthesis || null,
    events: [],
  }
  if (!profile) return plan

  for (const section of canonicalScore.sections) {
    const notes = section.events.filter((event) => event.kind === 'note')
    const groups = lyricGroups(notes)
    const groupByEvent = new Map(groups.flatMap((group) => group.notes.map((note, index) => [note.id, { group, index }])))
    const sanbanDurationByEvent = new Map(groups.flatMap((group) =>
      sanbanValues(group.notes.length, profile.rules.sanbanTiming).map((duration, index) => [group.notes[index].id, duration])))
    for (let index = 0; index < notes.length; index += 1) {
      const note = notes[index]
      const previous = notes[index - 1]
      const groupContext = groupByEvent.get(note.id)
      if (profile.rules.qikouPause.enabled && note.breathAfter) {
        plan.events.push(eventFor('qikou-pause', [note], section, profile, {}, profile.rules.qikouPause.duration, { event: note, at: 'end' }))
      }
      if (profile.rules.rushengTemplates.enabled && /入$/.test(note.lyricTone || '') && note.breathAfter && notes[index + 1]) {
        plan.events.push(eventFor('rusheng-template', notes.slice(index, index + Math.min(3, notes.length - index)), section, profile, {
          websiteDurations: notes[index + 2] ? [0.4, 0.2, 0.3, 0.4] : [0.4, 0.2, 0.6],
          qikouPosition: groupContext?.index ?? 0,
          sourceLines: '2883-2907',
        }))
      }
      if (profile.rules.samePitchReattack.enabled && previous &&
          previous.absolutePitch.value.midi === note.absolutePitch.value.midi &&
          previous.lyric?.text !== note.lyric?.text) {
        plan.events.push(eventFor('same-pitch-reattack', [previous, note], section, profile, {}, profile.rules.samePitchReattack.duration, { event: note }))
      }
      if (profile.rules.sanbanTiming.enabled && section.meter.value.senzaMisura) {
        const playbackDurationBeats = sanbanDurationByEvent.get(note.id)
        plan.events.push(eventFor('sanban-timing', [note], section, profile, { playbackDurationBeats }, fromNumber(playbackDurationBeats)))
      }
      if (profile.rules.slides.enabled && previous) {
        const interval = Math.abs(previous.absolutePitch.value.midi - note.absolutePitch.value.midi)
        if (interval > 0 && interval <= profile.rules.slides.maximumSemitones) {
          plan.events.push(eventFor('slide', [previous, note], section, profile, { semitones: note.absolutePitch.value.midi - previous.absolutePitch.value.midi }))
        }
      }
      if (profile.rules.vibrato.enabled && numeric(note.duration) >= profile.rules.vibrato.minimumBeats) {
        plan.events.push(eventFor('vibrato', [note], section, profile, { frequencyHz: profile.rules.vibrato.frequencyHz }))
      }
      if ((note.qiangge || []).length > 0) {
        plan.events.push(eventFor('qiangge-articulation', [note], section, profile, { codes: note.qiangge.map((item) => item.code) }))
        if (profile.rules.explicitQiangge.enabled && note.qiangge.some((item) => item.code === 'h')) {
          plan.events.push(eventFor('huoqiang-realization', [note, notes[index + 1]].filter(Boolean), section, profile, {
            neighbor: 'website-higher-neighbor', websiteDurations: [0.6, 0.3], sourceLines: '2814-2882',
            specialCase: ['凡', '乙'].includes(note.base) ? note.base : null,
            midiSequence: [note.absolutePitch.value.midi, huoqiangNeighborMidi(note)],
          }))
        }
        if (profile.rules.explicitQiangge.enabled && note.qiangge.some((item) => item.code === 's')) {
          plan.events.push(eventFor('souqiang-realization', [note], section, profile, {
            contour: ['main', 'upper-neighbor', 'main', 'upper-neighbor', 'main'], websiteDurations: [0.4, 0.5, 0.2, 0.2, 0.9], sourceLines: '2958-3070',
            positionInLyricGroup: groupContext?.index ?? 0,
            midiSequence: [note.absolutePitch.value.midi, upperNeighborMidi(note.absolutePitch.value.midi, true), note.absolutePitch.value.midi, upperNeighborMidi(note.absolutePitch.value.midi, true), note.absolutePitch.value.midi],
          }))
        }
      }
    }
    if (profile.rules.unmarkedTemplates.enabled) {
      for (let index = 0; index < notes.length - 2; index += 1) {
        const values = notes.slice(index, index + 3).map((note) => relativeValue(note, section))
        if (scaleDistance(values[1], values[0]) === -1 && scaleDistance(values[2], values[0]) === -2) {
          plan.events.push(eventFor('melodic-template', notes.slice(index, index + 3), section, profile, {
            template: 'website-three-note-huaqiang', websiteDurations: [0.3, 0.4, 0.8], sourceLines: '2908-2925',
          }))
        }
      }
    }
    if (profile.rules.hanqiangTemplates.enabled) {
      for (let index = 0; index < notes.length; index += 1) {
        const patterns = profile.rules.hanqiangTemplates.relativeValues
        const matched = patterns.find((values) => matchesValues(notes.slice(index), values, section))
        if (matched) {
          plan.events.push(eventFor('hanqiang-template', notes.slice(index, index + matched.length), section, profile, {
            relativeValues: matched, websiteDurations: [0.3, 0.3, 0.6], sourceLines: '1957-1982,3144-3182',
          }))
          index += matched.length - 1
        }
      }
    }
    if (profile.rules.unmarkedTemplates.enabled) {
      for (const group of groups) {
        const values = group.notes.map((note) => relativeValue(note, section))
        if (group.notes.length >= 5 && group.notes.length <= 7) {
          const tail = values.slice(-3)
          if (scaleDistance(tail[1], tail[0]) === -1 && scaleDistance(tail[2], tail[0]) === -2) {
            plan.events.push(eventFor('melodic-template', group.notes, section, profile, {
              template: 'website-big-huaqiang', groupSize: group.notes.length, sourceLines: 'shangban-big-huaqiang,2965-2992',
            }))
          }
        }
        if (group.notes.length === 4 && scaleDistance(values[1], values[0]) === 1 && values[2] === values[0] && values[3] === values[1]) {
          plan.events.push(eventFor('melodic-template', group.notes, section, profile, {
            template: 'website-four-note-wave', websiteRatio: [3, 1, 2, 2], sourceLines: 'shangban-four-note-wave',
          }))
        }
      }
    }
    const last = notes.at(-1)
    if (last && profile.rules.phraseEnding.enabled) {
      plan.events.push(eventFor('phrase-ending', [last], section, profile, {
        extension: profile.rules.phraseEnding.extension,
        tailRest: profile.rules.phraseEnding.tailRest,
      }, null, { event: last, at: 'end' }))
    }
  }
  return plan
}
