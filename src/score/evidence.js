export const EVIDENCE_STATUSES = ['confirmed', 'derived', 'inferred', 'unresolved']

export function evidence(value, status, ruleId = null, evidenceIds = [], note = null) {
  if (!EVIDENCE_STATUSES.includes(status)) throw new Error(`Unknown evidence status: ${status}`)
  if (status === 'confirmed' && evidenceIds.length === 0 && !note) {
    throw new Error('Confirmed values require evidence or an editorial note')
  }
  if ((status === 'derived' || status === 'inferred') && !ruleId && !note) {
    throw new Error(`${status} values require a rule or note`)
  }
  if (status === 'unresolved' && value !== null) throw new Error('Unresolved values must be null')
  return { value, status, ruleId, evidenceIds: [...evidenceIds], note }
}

export function inheritedStatus(...fields) {
  return fields.some((field) => field?.status === 'inferred' || field?.status === 'unresolved')
    ? 'inferred'
    : 'derived'
}
