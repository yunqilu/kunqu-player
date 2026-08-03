# Generate MusicXML through a relative-score intermediate representation

Conversion will first produce a versioned, reviewable relative-score JSON and will then generate MusicXML from that representation. This extra boundary preserves unresolved gongche semantics before any inference is applied, while still making MusicXML—not the intermediate JSON—the intended staff-notation deliverable after review and explicit resolution or traceable inference.
