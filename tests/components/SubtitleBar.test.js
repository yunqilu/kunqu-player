// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const phrase = (id, s, e, text, en, en_status = 'draft') => ({
  id, s, e, text, en, en_status, en_note: null, breaths: [],
  chars: [...text].map((ch, k) => ({ ch, s: s + k * 0.1, e: s + (k + 1) * 0.1, st: '普通唱', gc: [] })),
})

// 0→1 是 0.3 秒的短空隙，1→2 是长过门，第 3 句没有翻译
const subtitleModel = () => {
  const phrases = [
    phrase('p001', 10, 14, '秀才', 'Scholar!'),
    phrase('p002', 14.3, 18, '秀才', 'Scholar, again!', 'reviewed'),
    phrase('p003', 30, 34, '一径行来', 'I have walked the whole path here,'),
    phrase('p004', 40, 44, '呀', null, null),
  ]
  return {
    meta: { title: '寻梦', performer: '', source: '', video: '', span: [0, 60] },
    lines: phrases, phrases, breaths: [], tracks: [], sections: [], excluded: [],
  }
}

let SubtitleBar, clock, wrapper

beforeAll(async () => {
  const { model } = await import('../../src/lib/model.js')
  Object.assign(model, subtitleModel())
  clock = (await import('../../src/composables/useClock.js')).clock
  SubtitleBar = (await import('../../src/components/SubtitleBar.vue')).default
})

beforeEach(() => {
  clock.seek(0)
  wrapper = mount(SubtitleBar)
})

const at = async (t) => { clock.seek(t); await nextTick() }
const text = () => wrapper.find('.sub-text').text()
const visible = () => wrapper.find('.subtitle').classes().includes('on')

describe('SubtitleBar', () => {
  it('is empty and hidden before the first phrase', () => {
    expect(visible()).toBe(false)
  })

  it('shows the translation of the phrase being sung, marked as English', async () => {
    await at(12)

    expect(visible()).toBe(true)
    expect(text()).toBe('Scholar!')
    expect(wrapper.find('.sub-text').attributes('lang')).toBe('en')
  })

  it('hides when the phrase ends and an interlude begins', async () => {
    await at(16)
    await at(20)

    expect(visible()).toBe(false)
  })

  it('stays visible across a short gap and switches straight to the next phrase', async () => {
    await at(13.9)
    await at(14.1)
    expect(visible()).toBe(true)
    expect(text()).toBe('Scholar!')

    await at(14.4)
    expect(visible()).toBe(true)
    expect(text()).toBe('Scholar, again!')
  })

  it('follows a seek at once, forwards and backwards', async () => {
    await at(31)
    expect(text()).toBe('I have walked the whole path here,')

    await at(25)
    expect(visible()).toBe(false)

    await at(11)
    expect(visible()).toBe(true)
    expect(text()).toBe('Scholar!')
  })

  it('marks draft translations and drops the mark once reviewed', async () => {
    await at(12)
    expect(wrapper.find('.sub-draft').exists()).toBe(true)
    expect(wrapper.find('.sub-draft').text()).toBe('draft')

    await at(15)
    expect(wrapper.find('.sub-draft').exists()).toBe(false)
  })

  it('stays hidden for a phrase that has no translation', async () => {
    await at(41)

    expect(visible()).toBe(false)
  })
})

describe('clock phrase state', () => {
  it('reports whether the time is inside the current phrase', async () => {
    await at(12)
    expect([clock.activeLineIdx.value, clock.activePhraseOn.value]).toEqual([0, true])

    await at(20)
    expect([clock.activeLineIdx.value, clock.activePhraseOn.value]).toEqual([1, false])

    await at(5)
    expect([clock.activeLineIdx.value, clock.activePhraseOn.value]).toEqual([-1, false])
  })

  it('exposes the subtitle index with short gaps bridged', async () => {
    await at(14.1)
    expect([clock.activePhraseOn.value, clock.subtitleIdx.value]).toEqual([false, 0])

    await at(20)
    expect(clock.subtitleIdx.value).toBe(-1)
  })
})
