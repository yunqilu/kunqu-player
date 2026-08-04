import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DEFAULT_SCHEMA = fileURLToPath(new URL('../../../tests/vendor/musicxml-4.0/musicxml.xsd', import.meta.url))

export function validateMusicXmlWithXsd(xml, schemaPath = DEFAULT_SCHEMA) {
  const check = spawnSync('xmllint', ['--noout', '--schema', schemaPath, '-'], {
    input: xml,
    encoding: 'utf8',
  })
  if (check.error?.code === 'ENOENT') {
    return { valid: null, skipped: true, errors: ['xmllint is not installed'] }
  }
  const errors = `${check.stdout || ''}${check.stderr || ''}`.split('\n')
    .filter((line) => line && !line.endsWith('validates'))
  return { valid: check.status === 0, skipped: false, errors }
}
