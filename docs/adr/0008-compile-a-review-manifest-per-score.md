# Compile each playback projection with a review manifest

Each score keeps its original `viewerModel.json` unchanged and adds a versioned review manifest containing corrections, qupai sections, musical context, provenance, and title-specific profile overrides. An ingestion step compiles both into the reviewed gongche source, keeping editorial work inspectable and reusable without putting score-specific patches into the generic converter.
