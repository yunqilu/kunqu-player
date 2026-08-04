// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'

import ScoreReviewPanel from '../../src/components/ScoreReviewPanel.vue'
import { createScoreReviewState } from '../../src/composables/useScoreReview.js'

const projection = {
  meta: { title: '审阅测试' },
  lines: [{ id: 'review-line', text: '清', chars: [{ ch: '清', st: '普通唱', gc: [{ raw: '上/' }] }] }],
}
const manifest = {
  schemaVersion: 1, scoreId: 'review-score', profile: 'kunqu-default-v1',
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

    const wrapper = mount(ScoreReviewPanel, { props: { state } })
    expect(wrapper.get('[aria-label="五线谱审阅"]').exists()).toBe(true)
    await wrapper.get('.review-list button').trigger('click')
    expect(wrapper.text()).toContain('上/')
    expect(wrapper.text()).toContain('review-line')
    wrapper.unmount()
  })
})
