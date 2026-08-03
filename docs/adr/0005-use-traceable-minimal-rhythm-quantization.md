# Use minimal rhythm quantization when banshi rules are underdetermined

When confirmed Kunqu banshi rules do not uniquely determine durations between ban-yan anchors, the converter will preserve event order and anchor placement, then prefer equal subdivisions and the notation with the fewest dots and ties. The affected onset and duration fields remain explicitly inferred, because producing a reviewable staff score is more useful than omitting rhythm, while playback timestamps are not legitimate notation evidence.
