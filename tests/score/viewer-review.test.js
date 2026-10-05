// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'

import ScoreReviewPanel from '../../src/components/ScoreReviewPanel.vue'
import { setLang } from '../../src/i18n/index.js'
import { createScoreReviewState } from '../../src/composables/useScoreReview.js'
import { projectionHash } from '../../src/score/review/compileReview.js'

const projection = {
  meta: { title: '审阅测试' },
  lines: [{ id: 'review-line', text: '清', chars: [{ ch: '清', st: '普通唱', gc: [{ raw: '上/' }] }] }],
}
const manifest = {
  schemaVersion: 1, scoreId: 'review-score', profile: 'kunqu-default-v1',
  base: { sha256: projectionHash(projection) },
  sources: [{ id: 'edition', title: '审阅底本', kind: 'reviewed-score' }],
  corrections: [],
  sections: [{ id: 'review-section', start: { lineId: 'review-line', charIndex: 0 }, end: { lineId: 'review-line', charIndex: 0 }, banshi: 'sanban' }],
  textClassifications: [], overrides: [],
}

describe('Viewer score review loop', () => {
  test('confirms an inferred field through the manifest and keeps stable IDs', () => {
    const state = createScoreReviewState({ projection, manifest })
    const before = state.result.value.canonicalScore.sections[0].events[0]

    state.confirmField(before.id, 'duration', { numerator: 3, denominator: 2 }, '谱师确认')
    const after = state.result.value.canonicalScore.sections[0].events[0]

    expect(after.id).toBe(before.id)
    expect(after.duration).toMatchObject({ value: { numerator: 3, denominator: 2 }, status: 'confirmed', note: '谱师确认' })
    expect(state.reviewManifest.value.overrides).toHaveLength(1)
    expect(state.artifactText('reviewManifest')).toContain('谱师确认')
  })

  test('toggles playback independently and renders source provenance in the panel', async () => {
    const state = createScoreReviewState({ projection, manifest })
    const canonical = structuredClone(state.result.value.canonicalScore)
    expect(state.result.value.playbackPlan.events.length).toBeGreaterThan(0)
    state.setPlaybackEnabled(false)
    expect(state.result.value.playbackPlan.events).toEqual([])
    expect(state.result.value.canonicalScore).toEqual(canonical)

    setLang('zh', null)
    const wrapper = mount(ScoreReviewPanel, { props: { state } })
    expect(wrapper.get('[aria-label="五线谱审阅"]').exists()).toBe(true)
    await wrapper.findAll('.review-list button')[1].trigger('click')
    expect(wrapper.text()).toContain('上/')
    expect(wrapper.text()).toContain('review-line')
    wrapper.unmount()
  })

  test('shows its interface in English, keeping lyrics and gongche source text Chinese', async () => {
    setLang('en', null)
    const state = createScoreReviewState({ projection, manifest })
    const wrapper = mount(ScoreReviewPanel, { props: { state } })

    expect(wrapper.get('[aria-label="Staff score review"]').exists()).toBe(true)
    expect(wrapper.find('.review-head strong').text()).toBe('Staff score review')
    expect(wrapper.find('.count.inferred').text()).toMatch(/^Inferred \d+$/)
    expect(wrapper.find('.playback-toggle').text()).toBe('Playback effects')
    expect(wrapper.find('.import-button').text()).toBe('Import manifest')
    expect(wrapper.find('.review-detail p').text()).toMatch(/^Select an inferred item or a diagnostic/)

    await wrapper.findAll('.review-list button')[1].trigger('click')
    expect(wrapper.findAll('.review-detail dt').map((w) => w.text())).toEqual(['ID', 'Source text', 'Position', 'Rules', 'Evidence', 'Note'])
    expect(wrapper.find('.editor button').text()).toBe('Confirm and regenerate')
    expect(wrapper.text()).toContain('上/')

    const chrome = [
      ...wrapper.findAll('option').map((w) => w.text()),
      ...wrapper.findAll('[aria-label]').map((w) => w.attributes('aria-label')),
      ...wrapper.findAll('[placeholder]').map((w) => w.attributes('placeholder')),
      ...wrapper.findAll('dt').map((w) => w.text()),
    ]
    expect(chrome.filter((text) => /[\u3400-\u9fff]/.test(text))).toEqual([])
    wrapper.unmount()
    setLang('zh', null)
  })

  test('reloads a downloaded manifest deterministically and filters by section and field', () => {
    const state = createScoreReviewState({ projection, manifest })
    const first = state.result.value.canonicalScore.sections[0].events[0]
    state.confirmField(first.id, 'duration', { numerator: 3, denominator: 2 }, '复载测试')
    const downloaded = state.artifactText('reviewManifest')
    const expected = structuredClone(state.result.value.canonicalScore)

    state.loadManifest(downloaded)
    expect(state.result.value.canonicalScore).toEqual(expected)
    expect(state.dirty.value).toBe(false)
    state.sectionFilter.value = 'review-section'
    state.fieldFilter.value = 'absolutePitch'
    expect(state.entries.value.every((entry) => entry.sectionId === 'review-section')).toBe(true)
  })

  test('confirms section-level meter and tuning through the same replayable manifest', () => {
    const state = createScoreReviewState({ projection, manifest })

    state.confirmField('review-section', 'banshi', 'one-ban-one-yan', '板式确认')
    state.confirmField('review-section', 'shangPitch', 'C4', '定调确认')
    const section = state.result.value.canonicalScore.sections[0]

    expect(section.meter.value).toMatchObject({ beats: 2, beatType: 4 })
    expect(section.tuning.value.shangPitch).toBe('C4')
    expect(section.events.find((event) => event.kind === 'note').absolutePitch.value.midi).toBe(60)
    expect(state.sectionEntries.value).toHaveLength(1)
  })
})
