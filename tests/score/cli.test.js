import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
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
      '--conversion-profile', path.join(root, 'src/data/profiles/kunqu-default-v1.json'),
    ], { cwd: root, encoding: 'utf8' })

    expect(JSON.parse(output)).toMatchObject({ converted: 2 })
    for (const directory of [first, second]) {
      const files = ['reviewed-source.json', 'relative-score.json', 'canonical-score.json', 'score.musicxml', 'playback-plan.json', 'diagnostics.json']
      expect(files.every((file) => readFileSync(path.join(directory, file), 'utf8').length > 0)).toBe(true)
    }
    expect(execFileSync(process.execPath, [path.join(root, 'scripts/score-validate.mjs'), first, second], { cwd: root, encoding: 'utf8' })).toContain('valid')
  })

  test('loads a score-specific conversion profile from the CLI', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'kunqu-profile-'))
    const out = path.join(temp, 'out')
    const customProfilePath = path.join(temp, 'custom-profile.json')
    const customReviewPath = path.join(temp, 'custom-review.json')
    const profile = JSON.parse(readFileSync(path.join(root, 'src/data/profiles/kunqu-default-v1.json'), 'utf8'))
    const manifest = JSON.parse(readFileSync(review, 'utf8'))
    profile.id = 'custom-cli-v1'
    profile.defaultShangMidi = 60
    manifest.profile = profile.id
    writeFileSync(customProfilePath, JSON.stringify(profile))
    writeFileSync(customReviewPath, JSON.stringify(manifest))

    execFileSync(process.execPath, [
      path.join(root, 'scripts/score-convert.mjs'), '--viewer', viewer, '--review', customReviewPath,
      '--out', out, '--conversion-profile', customProfilePath, '--no-playback',
    ], { cwd: root, encoding: 'utf8' })
    const canonical = JSON.parse(readFileSync(path.join(out, 'canonical-score.json'), 'utf8'))

    expect(canonical.profile).toBe('custom-cli-v1')
    expect(canonical.sections[0].events[0].absolutePitch.value.midi).toBe(60)
  })
})
