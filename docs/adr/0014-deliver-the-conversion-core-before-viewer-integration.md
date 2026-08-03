# Deliver a shared conversion core before viewer integration

The first milestone provides a browser-safe pure JavaScript conversion core, CLI exports, review manifests, generated artifacts, and automated tests; the second integrates inference review and MusicXML download into the existing Vue viewer. Both surfaces call the same core, making batch conversion reusable across scores while keeping UI work from blocking validation of the musical pipeline.
