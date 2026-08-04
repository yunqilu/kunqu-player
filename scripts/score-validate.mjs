#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { validateArtifact, validateMusicXml } from '../src/score/schema/validate.js'

const directories = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
if (directories.length === 0) {
  process.stderr.write('Usage: score-validate ARTIFACT_DIR [...]\n')
  process.exitCode = 1
} else {
  try {
    for (const directory of directories) {
      const artifacts = {
        reviewedSource: JSON.parse(await readFile(path.join(directory, 'reviewed-source.json'), 'utf8')),
        relativeScore: JSON.parse(await readFile(path.join(directory, 'relative-score.json'), 'utf8')),
        canonicalScore: JSON.parse(await readFile(path.join(directory, 'canonical-score.json'), 'utf8')),
        playbackPlan: JSON.parse(await readFile(path.join(directory, 'playback-plan.json'), 'utf8')),
      }
      for (const [kind, value] of Object.entries(artifacts)) {
        const validation = validateArtifact(kind, value)
        if (!validation.valid) throw new Error(`${directory}/${kind}: ${validation.errors.join('; ')}`)
      }
      const xml = await readFile(path.join(directory, 'score.musicxml'), 'utf8')
      const xmlValidation = validateMusicXml(xml)
      if (!xmlValidation.valid) throw new Error(`${directory}/score.musicxml: ${xmlValidation.errors.join('; ')}`)
      process.stdout.write(`${directory}: valid\n`)
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}
