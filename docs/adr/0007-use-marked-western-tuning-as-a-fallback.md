# Use marked Western tuning when only dise is known

If a section identifies its dise but provides no exact concert pitch or temperament, export will use the formal approximate Western key mapping with 12-tone equal temperament at A4=440. All resulting absolute pitches remain inferred and are superseded by edition- or performance-specific tuning, because this fallback enables interoperable staff notation without claiming that traditional Kunqu tuning is identical to Western temperament.

If no dise can be resolved at all, the converter defaults to `1=D` rather than producing a key-neutral reference score. That choice is visibly marked as inferred and remains overridable, so every score can be rendered while the absence of historical tuning evidence stays explicit.
