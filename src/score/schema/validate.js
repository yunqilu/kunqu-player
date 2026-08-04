import Ajv from 'ajv'

import canonicalScoreSchema from './canonical-score.schema.json' with { type: 'json' }
import playbackPlanSchema from './playback-plan.schema.json' with { type: 'json' }
import relativeScoreSchema from './relative-score.schema.json' with { type: 'json' }
import reviewManifestSchema from './review-manifest.schema.json' with { type: 'json' }
import reviewedSourceSchema from './reviewed-source.schema.json' with { type: 'json' }

const ajv = new Ajv({ allErrors: true, strict: false })
const validators = {
  reviewManifest: ajv.compile(reviewManifestSchema),
  reviewedSource: ajv.compile(reviewedSourceSchema),
  relativeScore: ajv.compile(relativeScoreSchema),
  canonicalScore: ajv.compile(canonicalScoreSchema),
  playbackPlan: ajv.compile(playbackPlanSchema),
}

function evidenceErrors(value, path = '', errors = []) {
  if (!value || typeof value !== 'object') return errors
  if (!Array.isArray(value) && typeof value.status === 'string' && 'value' in value) {
    if (!['confirmed', 'derived', 'inferred', 'unresolved'].includes(value.status)) errors.push(`${path}.status is invalid`)
    if (value.status === 'confirmed' && !(value.evidenceIds?.length > 0) && !value.note) errors.push(`${path} confirmed value has no evidence`)
    if ((value.status === 'derived' || value.status === 'inferred') && !value.ruleId && !value.note) errors.push(`${path} ${value.status} value has no rule`)
    if (value.status === 'unresolved' && value.value !== null) errors.push(`${path} unresolved value is not null`)
  }
  for (const [key, child] of Object.entries(value)) evidenceErrors(child, path ? `${path}.${key}` : key, errors)
  return errors
}

export function validateArtifact(kind, value) {
  const validator = validators[kind]
  if (!validator) throw new Error(`Unknown artifact schema: ${kind}`)
  const valid = validator(value)
  const errors = (validator.errors || []).map((error) => `${error.instancePath || '/'} ${error.message}`)
  evidenceErrors(value, '', errors)
  return { valid: valid && errors.length === 0, errors }
}

export function validateMusicXml(xml) {
  const errors = []
  if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) errors.push('missing XML declaration')
  if (!xml.includes('<score-partwise version="4.0">')) errors.push('missing MusicXML 4.0 root')
  if (!xml.includes('<part-list>') || !xml.includes('<part id="P1">')) errors.push('missing score part')
  const noteIds = [...xml.matchAll(/<note id="([^"]+)"/g)].map((match) => match[1])
  if (new Set(noteIds).size !== noteIds.length) errors.push('duplicate note IDs')
  return { valid: errors.length === 0, errors }
}
