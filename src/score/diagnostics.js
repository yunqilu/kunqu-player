export function diagnostic(code, severity, message, details = {}) {
  return {
    code,
    severity,
    message,
    sourceRef: details.sourceRef || null,
    eventIds: details.eventIds || [],
    fieldPath: details.fieldPath || null,
    suggestedAction: details.suggestedAction || null,
  }
}
