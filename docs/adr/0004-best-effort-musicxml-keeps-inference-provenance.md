# Export a best-effort score with traceable inference

MusicXML export should produce the most accurate score supported by the available evidence instead of failing whenever a musical value remains unresolved. Every inferred value must remain visibly distinguishable from confirmed values and carry a provenance chain through the relative-score representation, because a usable draft is valuable only when editors can locate, inspect, and replace its guesses.

MusicXML will therefore use visible color and compact field labels for human review, plus stable element IDs that link to field-level inference records in the relative-score JSON. The JSON remains authoritative for rules, source locations, and confidence because MusicXML has editorial metadata but no standard field-level inference model.
