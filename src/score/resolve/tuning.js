import { evidence } from '../evidence.js'
import { diagnostic } from '../diagnostics.js'
import { absolutePitchFromShang } from '../gongche/pitch.js'

const PITCH_RE = /^([A-G])([#b]?)(-?\d+)$/
const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function pitchToMidi(value) {
  if (typeof value === 'number') return value
  const match = PITCH_RE.exec(value || '')
  if (!match) return null
  const alter = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0
  return (Number(match[3]) + 1) * 12 + STEP[match[1]] + alter
}

function fieldValue(field) {
  return field && typeof field === 'object' && 'value' in field ? field.value : field
}

function midiToPitchName(midi) {
  const names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

export function resolveTuning(section, profile, diagnostics) {
  const explicitPitch = fieldValue(section.shangPitch)
  const dise = fieldValue(section.dise)
  let shangMidi = pitchToMidi(explicitPitch)
  let status = section.shangPitch?.status || (explicitPitch ? 'confirmed' : null)
  let ruleId = status === 'confirmed' ? null : 'section-tuning-v1'
  let evidenceIds = section.shangPitch?.evidenceIds || section.evidenceIds || []
  let note = section.shangPitch?.note || null

  if (shangMidi == null && dise && profile.diseShangMidi[dise] != null) {
    shangMidi = profile.diseShangMidi[dise]
    status = 'inferred'
    ruleId = 'approximate-western-dise-v1'
  }
  if (shangMidi == null) {
    shangMidi = profile.defaultShangMidi
    status = 'inferred'
    ruleId = 'default-1-equals-d-v1'
    diagnostics.push(diagnostic('TUNING_INFERRED', 'warning', '缺少明确笛色，采用上=D4'))
  }
  return {
    context: evidence({
      dise: dise || null,
      shangPitch: explicitPitch || midiToPitchName(shangMidi),
      shangMidi,
      temperament: fieldValue(section.temperament) || profile.temperament,
      referenceHz: fieldValue(section.referenceHz) || profile.referenceHz,
    }, status, ruleId, evidenceIds, note || (status === 'confirmed' && evidenceIds.length === 0 ? '曲牌区段明确标注' : null)),
    pitch(relativePitch) {
      const absolute = absolutePitchFromShang(relativePitch, shangMidi)
      return evidence(absolute, status === 'confirmed' ? 'derived' : 'inferred', status === 'confirmed' ? 'relative-to-confirmed-shang-v1' : ruleId, evidenceIds)
    },
  }
}
