#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import playbackProfileDefault from '../src/data/profiles/gongchepu-playback-2020-v1.json' with { type: 'json' }
import { stableStringify } from '../src/score/ids.js'
import { convertKunquScore } from '../src/score/pipeline.js'
import { validateArtifact, validateMusicXml } from '../src/score/schema/validate.js'
import { validateMusicXmlWithXsd } from '../src/score/schema/validateMusicXmlNode.js'

function parseArgs(argv) {
  const args = { jobs: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    if (key === '--no-playback') args.noPlayback = true
    else if (key === '--job') args.jobs.push(argv[++index])
    else if (key.startsWith('--')) args[key.slice(2)] = argv[++index]
  }
  if (args.batch) return { ...args, mode: 'batch-file' }
  if (args.jobs.length > 0) return { ...args, mode: 'jobs' }
  if (args.viewer && args.review && args.out) return { ...args, mode: 'single' }
  throw new Error('Usage: score-convert --viewer VIEWER --review REVIEW --out DIR [--conversion-profile PROFILE] | --job VIEWER::REVIEW::DIR[::PLAYBACK::CONVERSION] | --batch JOBS.json')
}

async function loadJson(filename) {
  return JSON.parse(await readFile(filename, 'utf8'))
}

async function resolveJobs(args) {
  if (args.mode === 'single') return [{ viewer: args.viewer, review: args.review, out: args.out, playback: args.playback, conversionProfile: args['conversion-profile'] }]
  if (args.mode === 'jobs') return args.jobs.map((job) => {
    const [viewer, review, out, playback, conversionProfile] = job.split('::')
    if (!viewer || !review || !out) throw new Error(`Invalid --job: ${job}`)
    return { viewer, review, out, playback, conversionProfile }
  })
  const jobs = await loadJson(args.batch)
  if (!Array.isArray(jobs)) throw new Error('Batch file must contain an array of jobs')
  return jobs
}

async function writeJson(filename, value) {
  await writeFile(filename, `${stableStringify(value)}\n`, 'utf8')
}

async function convertJob(job, args) {
  const projection = await loadJson(job.viewer)
  const reviewManifest = await loadJson(job.review)
  const manifestValidation = validateArtifact('reviewManifest', reviewManifest)
  if (!manifestValidation.valid) throw new Error(`Invalid review manifest: ${manifestValidation.errors.join('; ')}`)
  const playbackProfile = args.noPlayback ? null : job.playback ? await loadJson(job.playback) : playbackProfileDefault
  const conversionProfilePath = job.conversionProfile || args['conversion-profile']
  const conversionProfile = conversionProfilePath ? await loadJson(conversionProfilePath) : null
  const result = convertKunquScore({ projection, reviewManifest, conversionProfile, playbackProfile })
  const fatal = result.diagnostics.filter((item) => item.severity === 'fatal')
  if (fatal.length > 0) throw new Error(`Fatal conversion diagnostics: ${fatal.map((item) => item.code).join(', ')}`)
  const validations = [
    ['reviewedSource', result.reviewedSource],
    ['relativeScore', result.relativeScore],
    ['canonicalScore', result.canonicalScore],
    ['playbackPlan', result.playbackPlan],
  ].map(([kind, value]) => [kind, validateArtifact(kind, value)])
  const invalid = validations.filter(([, validation]) => !validation.valid)
  const xmlValidation = validateMusicXml(result.musicXml)
  const xsdValidation = validateMusicXmlWithXsd(result.musicXml)
  if (invalid.length > 0 || !xmlValidation.valid || xsdValidation.valid === false) {
    throw new Error(`Generated artifact validation failed: ${invalid.map(([kind]) => kind).concat(xmlValidation.valid ? [] : ['musicXml']).join(', ')}`)
  }
  await mkdir(job.out, { recursive: true })
  await Promise.all([
    writeJson(path.join(job.out, 'reviewed-source.json'), result.reviewedSource),
    writeJson(path.join(job.out, 'relative-score.json'), result.relativeScore),
    writeJson(path.join(job.out, 'canonical-score.json'), result.canonicalScore),
    writeFile(path.join(job.out, 'score.musicxml'), `${result.musicXml}\n`, 'utf8'),
    writeJson(path.join(job.out, 'playback-plan.json'), result.playbackPlan),
    writeJson(path.join(job.out, 'diagnostics.json'), result.diagnostics),
  ])
  const notes = result.relativeScore.sections.flatMap((section) => section.events).filter((event) => event.kind === 'note').length
  return { scoreId: reviewManifest.scoreId, out: job.out, notes, diagnostics: result.diagnostics.length }
}

try {
  const args = parseArgs(process.argv.slice(2))
  const jobs = await resolveJobs(args)
  const summaries = []
  for (const job of jobs) summaries.push(await convertJob(job, args))
  process.stdout.write(`${stableStringify({ converted: summaries.length, scores: summaries })}\n`)
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
