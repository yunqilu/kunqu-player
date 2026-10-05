# Convert from a reviewed gongche source

The converter will read a reviewed gongche source, while `viewerModel.json` remains a playback projection. Known omissions such as the six symbols near “杨” (the lyric character yáng) must be corrected with provenance in the source rather than hidden in converter logic, because embedding editorial patches in conversion would make completeness dependent on an opaque implementation detail.
