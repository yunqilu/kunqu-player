import { diagnostic } from '../diagnostics.js'
import { evidence } from '../evidence.js'

function findTarget(score, targetId) {
  for (const section of score.sections) {
    if (section.id === targetId) return section
    const event = section.events.find((candidate) => candidate.id === targetId)
    if (event) return event
  }
  return null
}

export function applyOverrides(canonicalScore, overrides, diagnostics, { ignoreMissing = false, appliedIds = null } = {}) {
  for (const override of overrides || []) {
    const target = findTarget(canonicalScore, override.targetId)
    const allowedSectionField = target && 'events' in target && ['banshi', 'dise', 'shangPitch', 'temperament', 'referenceHz'].includes(override.fieldPath)
    if (!target || !override.fieldPath || !(override.fieldPath in target) && !allowedSectionField) {
      if (ignoreMissing) continue
      diagnostics.push(diagnostic('OVERRIDE_TARGET_MISMATCH', 'error', `人工覆盖目标未命中：${override.id}`, {
        eventIds: override.targetId ? [override.targetId] : [],
        fieldPath: override.fieldPath || null,
      }))
      continue
    }
    target[override.fieldPath] = evidence(
      structuredClone(override.value),
      'confirmed',
      null,
      override.evidenceIds || [],
      override.note || '人工审阅确认',
    )
    appliedIds?.add(override.id)
    if (target.kind === 'note') {
      target.colorRole = [target.absolutePitch, target.onset, target.duration].some((field) => field?.status === 'inferred') ? 'inferred' : 'normal'
    }
  }
  return canonicalScore
}
