# Infer rests only from gaps required by confirmed meter

Minimal quantization may insert an inferred rest when a confirmed metered section and its ban-yan anchors require an unoccupied metric span. It never creates rests from an empty gongche array, breath code, bottom-board marker alone, or playback-time gap, and it does not fill free-meter sections, so MusicXML measures can close without mistaking absent annotation data for silence.
