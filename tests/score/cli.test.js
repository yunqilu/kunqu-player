import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

const root = path.resolve(import.meta.dirname, '../..')
const viewer = path.join(root, 'tests/fixtures/gongche/simple-viewer.json')
const review = path.join(root, 'tests/fixtures/gongche/simple-review.json')

describe('score conversion CLI', () => {
  test('batch converts arbitrary scores into the six validated artifacts', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'kunqu-score-'))
    const first = path.join(temp, 'first')
    const second = path.join(temp, 'second')
    const output = execFileSync(process.execPath, [
      path.join(root, 'scripts/score-convert.mjs'),
      '--job', `${viewer}::${review}::${first}`,
      '--job', `${viewer}::${review}::${second}`,
      '--no-playback',
    ], { cwd: root, encoding: 'utf8' })

    expect(JSON.parse(output)).toMatchObject({ converted: 2 })
    for (const directory of [first, second]) {
      const files = ['reviewed-source.json', 'relative-score.json', 'canonical-score.json', 'score.musicxml', 'playback-plan.json', 'diagnostics.json']
      expect(files.every((file) => readFileSync(path.join(directory, file), 'utf8').length > 0)).toBe(true)
    }
    expect(execFileSync(process.execPath, [path.join(root, 'scripts/score-validate.mjs'), first, second], { cwd: root, encoding: 'utf8' })).toContain('valid')
  })
})
