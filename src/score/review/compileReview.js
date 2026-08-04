import { sha256, stableStringify } from '../ids.js'
import { diagnostic } from '../diagnostics.js'

export function projectionHash(projection) {
  return sha256(stableStringify(projection))
}

export function compileReview(projection, manifest, diagnostics) {
  const baseHash = projectionHash(projection)
  if (manifest.base?.sha256 && manifest.base.sha256 !== baseHash) {
    diagnostics.push(diagnostic('BASE_HASH_MISMATCH', 'fatal', '校订清单与播放投影 hash 不匹配'))
  }
  const lines = (projection.lines || []).map((line) => ({
    id: line.id,
    text: line.text,
    mediaRef: { start: line.s, end: line.e },
    chars: (line.chars || []).map((char, charIndex) => ({
      ch: char.ch,
      style: char.st || null,
      sourceRef: { lineId: line.id, charIndex },
      mediaRef: { start: char.s, end: char.e },
      gc: (char.gc || []).map((symbol, gongcheIndex) => ({
        raw: symbol.raw,
        sourceRef: { lineId: line.id, charIndex, gongcheIndex },
        flattened: { b: symbol.b, r: symbol.r, p: symbol.p, bt: symbol.bt, o: symbol.o, q: symbol.q },
        mediaRef: { start: symbol.s, end: symbol.e },
      })),
    })),
  }))

  for (const correction of manifest.corrections || []) {
    if (correction.op !== 'replaceCharGongche') continue
    const line = lines.find((candidate) => candidate.id === correction.target.lineId)
    const char = line?.chars[correction.target.charIndex]
    if (!char || char.ch !== correction.target.expectedChar) {
      diagnostics.push(diagnostic('CORRECTION_TARGET_MISMATCH', 'fatal', `校订目标未命中：${correction.id}`, {
        sourceRef: correction.target,
        suggestedAction: '核对 lineId、charIndex 与 expectedChar',
      }))
      continue
    }
    char.gc = correction.raw.map((raw, gongcheIndex) => ({
      raw,
      correctionId: correction.id,
      sourceRef: { lineId: line.id, charIndex: correction.target.charIndex, gongcheIndex },
      flattened: null,
      mediaRef: null,
    }))
  }

  const explicitClassifications = new Map((manifest.textClassifications || []).filter((item) => item.target).map((item) => [
    `${item.target.lineId}:${item.target.charIndex}`,
    item,
  ]))
  const defaultRules = manifest.textClassificationDefaults || []
  const textClassifications = []
  for (const line of lines) {
    for (const char of line.chars) {
      if (char.gc.length > 0) continue
      const key = `${line.id}:${char.sourceRef.charIndex}`
      const explicit = explicitClassifications.get(key)
      const rule = defaultRules.find((candidate) => !candidate.style || candidate.style === char.style)
      const classification = explicit || (rule ? {
        target: { lineId: line.id, charIndex: char.sourceRef.charIndex, expectedChar: char.ch },
        kind: rule.kind,
        status: rule.status || 'inferred',
        ruleId: rule.ruleId || 'text-classification-default-v1',
      } : null)
      if (classification) textClassifications.push(classification)
      else {
        textClassifications.push({
          target: { lineId: line.id, charIndex: char.sourceRef.charIndex, expectedChar: char.ch },
          kind: 'unresolved',
          status: 'unresolved',
          ruleId: 'unclassified-empty-gongche-v1',
        })
        diagnostics.push(diagnostic('TEXT_EVENT_UNRESOLVED', 'warning', `无工尺文字“${char.ch}”尚未分类`, { sourceRef: char.sourceRef }))
      }
    }
  }

  const semanticSource = {
    scoreId: manifest.scoreId,
    meta: projection.meta || {},
    lines: lines.map((line) => ({
      id: line.id,
      text: line.text,
      chars: line.chars.map((char) => ({ ch: char.ch, style: char.style, gc: char.gc.map((item) => item.raw) })),
    })),
    sections: manifest.sections || [],
    textClassifications,
  }
  return {
    schemaVersion: 1,
    scoreId: manifest.scoreId,
    baseHash,
    sourceHash: sha256(stableStringify(semanticSource)),
    reviewHash: sha256(stableStringify(manifest)),
    meta: structuredClone(projection.meta || {}),
    sources: structuredClone(manifest.sources || []),
    lines,
    sections: structuredClone(manifest.sections || []),
    textClassifications,
    overrides: structuredClone(manifest.overrides || []),
  }
}
