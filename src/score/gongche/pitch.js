export const GONGCHE_PITCHES = {
  合: { degree: 5, octave: -1 }, 四: { degree: 6, octave: -1 }, 一: { degree: 7, octave: -1 },
  上: { degree: 1, octave: 0 }, 尺: { degree: 2, octave: 0 }, 工: { degree: 3, octave: 0 },
  凡: { degree: 4, octave: 0 }, 六: { degree: 5, octave: 0 }, 五: { degree: 6, octave: 0 }, 乙: { degree: 7, octave: 0 },
}

export function relativePitch(base, register = 0) {
  const pitch = GONGCHE_PITCHES[base]
  return pitch ? { degree: pitch.degree, octave: pitch.octave + register } : null
}

const D_MAJOR = [0, 0, 2, 4, 5, 7, 9, 11]
const NAMES = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]]

export function absolutePitchFromShang(relative, shangMidi = 62) {
  const midi = shangMidi + D_MAJOR[relative.degree] + relative.octave * 12
  const [step, alter] = NAMES[(midi % 12 + 12) % 12]
  return { step, alter, octave: Math.floor(midi / 12) - 1, midi }
}
