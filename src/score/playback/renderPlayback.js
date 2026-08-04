import { sha256, stableId, stableStringify } from '../ids.js'

const MARKERS = {
  'qikou-pause': '气口停顿',
  'same-pitch-reattack': '同音换字',
  'phrase-ending': '句尾延长',
  'sanban-timing': '散板时值',
  'melodic-template': '花腔模板',
  slide: '滑音',
  vibrato: '振音',
  'qiangge-articulation': '腔格润饰',
}

function numeric(field) {
  return field.value.numerator / field.value.denominator
}

function eventFor(kind, sourceEvents, section, profile, parameters = {}, duration = null) {
  const first = sourceEvents[0]
  const id = stableId('pb', kind, ...sourceEvents.map((event) => event.id))
  return {
    id,
    sourceEventIds: sourceEvents.map((event) => event.id),
    ruleId: `gongchepu-${kind}-v1`,
    kind,
    beatOnset: first.onset.value,
    beatDuration: duration || first.duration.value,
    parameters,
    scoreMarker: {
      id: stableId('mark', id),
      text: MARKERS[kind],
      colorRole: 'playback',
      sectionId: section.id,
      measureIndex: first.measureIndex || 0,
    },
  }
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
    for (let index = 0; index < notes.length; index += 1) {
      const note = notes[index]
      const previous = notes[index - 1]
      if (profile.rules.qikouPause.enabled && note.breathAfter) {
        plan.events.push(eventFor('qikou-pause', [note], section, profile, {}, profile.rules.qikouPause.duration))
      }
      if (profile.rules.samePitchReattack.enabled && previous &&
          previous.absolutePitch.value.midi === note.absolutePitch.value.midi &&
          previous.lyric?.text !== note.lyric?.text) {
        plan.events.push(eventFor('same-pitch-reattack', [previous, note], section, profile, {}, profile.rules.samePitchReattack.duration))
      }
      if (profile.rules.sanbanTiming.enabled && section.meter.value.senzaMisura) {
        const values = notes.length === 1
          ? [profile.rules.sanbanTiming.single]
          : notes.length === 2
            ? profile.rules.sanbanTiming.two
            : notes.map((_, noteIndex) => noteIndex === notes.length - 1 ? profile.rules.sanbanTiming.last : profile.rules.sanbanTiming.fallback)
        plan.events.push(eventFor('sanban-timing', [note], section, profile, { playbackDurationBeats: values[index] }))
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
      }
    }
    if (profile.rules.unmarkedTemplates.enabled) {
      for (let index = 0; index < notes.length - 2; index += 1) {
        const pitches = notes.slice(index, index + 3).map((note) => note.absolutePitch.value.midi)
        if (pitches[0] > pitches[1] && pitches[1] > pitches[2]) {
          plan.events.push(eventFor('melodic-template', notes.slice(index, index + 3), section, profile, { template: 'three-note-descending' }))
        }
      }
    }
    const last = notes.at(-1)
    if (last && profile.rules.phraseEnding.enabled) {
      plan.events.push(eventFor('phrase-ending', [last], section, profile, {
        extension: profile.rules.phraseEnding.extension,
        tailRest: profile.rules.phraseEnding.tailRest,
      }))
    }
  }
  return plan
}
