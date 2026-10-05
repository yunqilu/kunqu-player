// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const sym = (b, s, e) => ({ b, r: 0, p: false, bt: '', o: '', q: false, raw: b, s, e })
const ch = (c, s, e, src = 'lyrics', gc = []) => ({ i: 0, ch: c, s, e, st: '普通唱', src, gc })
const base = { variants: [], qiangge: [], actions: [], points: [], breaths: [], evidence: ['x'], evidence_items: [], lyric: null }

const flowModel = () => {
  const phrases = [
    {
      ...base, id: 'p001', index: 0, qupai: '懒画眉', kind: '唱', status: 'variant', text: '但觉思情', s: 10, e: 17,
      chars: [
        ch('但', 10, 11, 'lyrics', [sym('工', 10, 10.5), sym('尺', 10.5, 11)]),
        ch('觉', 11, 12),
        { ...ch('思', 12, 16, 'variant'), i: 2 },
        { ...ch('情', 16, 17, 'variant'), i: 3 },
      ],
      variants: [{ i: 2, performed: '思', lyric: '情' }, { i: 3, performed: '情', lyric: '思' }],
      qiangge: [{ t: '擞腔', s: 12.5, e: 22, cs: 12.5, ce: 17, cont_prev: false, cont_next: true }],
      actions: [
        { t: '指', s: 10, e: 11, cs: 10, ce: 11, cont_prev: false, cont_next: false, provisional: false },
        { t: '换边', s: 11, e: 12, cs: 11, ce: 12, cont_prev: false, cont_next: false, provisional: true },
      ],
      points: [
        { t: 10.2, l: '相', tk: 'x', provisional: false },
        { t: 11.5, l: '打音', tk: 'x', provisional: true },
      ],
      breaths: [{ t: 17.5, l: '', tk: 'b' }],
    },
    {
      ...base, id: 'p002', index: 1, qupai: '懒画眉', kind: '唱', status: 'variant', text: '啊线', s: 20, e: 23,
      chars: [ch('啊', 20, 21, 'attached'), ch('线', 21, 23)],
      qiangge: [{ t: '擞腔', s: 12.5, e: 22, cs: 20, ce: 22, cont_prev: true, cont_next: false }],
    },
    {
      ...base, id: 'p003', index: 2, qupai: null, kind: '白', status: 'inferred', text: '丽娘', s: 30, e: 32,
      chars: [ch('丽', 30, 31, 'tail'), ch('娘', 31, 32, 'tail')],
    },
    {
      ...base, id: 'p004', index: 3, qupai: null, kind: '唱', status: 'inferred', text: '少', s: 40, e: 41,
      chars: [ch('少', 40, 41, 'tail')],
    },
  ]
  return {
    meta: { title: 't', performer: '', source: '', video: '', span: [10, 45] },
    lines: phrases, phrases, tracks: [], omitted: [], stats: {},
    breaths: [{ t: 17.5, l: '', tk: 'b' }],
    excluded: [{ ch: '哭？', s: 33, e: 36, reason: '用户决定删除', reason_en: 'Removed by the editor' }],
    sections: [
      { key: 's01', qupai: '懒画眉', kind: '唱', phrase_ids: ['p001', 'p002'] },
      { key: 's02', qupai: null, kind: '白', phrase_ids: ['p003'] },
      { key: 's03', qupai: null, kind: '唱', phrase_ids: ['p004'] },
    ],
  }
}

let PhraseFlow, clock, wrapper, i18n

beforeAll(async () => {
  Element.prototype.scrollIntoView = vi.fn()
  i18n = await import('../../src/i18n/index.js')
  const { model } = await import('../../src/lib/model.js')
  Object.assign(model, flowModel())
  clock = (await import('../../src/composables/useClock.js')).clock
  PhraseFlow = (await import('../../src/components/PhraseFlow.vue')).default
})

beforeEach(() => {
  localStorage.clear()
  i18n.setLang('zh', null) // 默认按中文界面断言；英文见最后一组
  clock.seek(10)
  wrapper = mount(PhraseFlow, { attachTo: document.body })
})

const row = (i) => wrapper.find(`.row[data-i="${i}"]`)
const char = (i, text) => row(i).findAll('.ch').find((w) => w.text() === text)
const px = (w, prop) => parseFloat(w.element.style[prop])

describe('PhraseFlow layout', () => {
  it('puts every phrase on its own row, in order', () => {
    const texts = wrapper.findAll('.row').map((r) => r.findAll('.ch').map((c) => c.text()).join(''))

    expect(texts).toEqual(['但觉思情', '啊线', '丽娘', '少'])
  })

  it('labels the first row of each section with its qupai or kind', () => {
    expect(wrapper.findAll('.row').map((r) => r.find('.row-nm').text())).toEqual(['【懒画眉】', '', '白', '唱'])
  })

  it('makes a long character visibly wider than a short one', () => {
    expect(px(char(0, '思'), 'width')).toBeGreaterThan(px(char(0, '但'), 'width') * 1.3)
  })

  it('underlines variant characters and shows the lyric on hover', () => {
    expect(char(0, '思').classes()).toContain('variant')
    expect(char(0, '思').attributes('title')).toContain('歌词作「情」')
    expect(char(0, '但').classes()).not.toContain('variant')
  })

  it('marks characters that are not in the lyrics', () => {
    expect(char(1, '啊').classes()).toContain('attached')
    expect(char(1, '啊').attributes('title')).toContain('不在歌词中')
  })

  it('marks inferred rows', () => {
    expect(row(2).classes()).toContain('inferred')
    expect(row(0).classes()).not.toContain('inferred')
  })

  it('positions gongche notes by their own times inside the character', () => {
    const [gong, che] = row(0).findAll('.nt')

    expect(px(gong, 'left')).toBe(0)
    expect(px(che, 'left')).toBeCloseTo(px(char(0, '但'), 'width') / 2)
  })

  it('draws a block across the characters it spans and flags continuation', () => {
    const first = row(0).find('.qg-b')
    const second = row(1).find('.qg-b')

    expect(px(first, 'width')).toBeGreaterThan(px(char(0, '思'), 'width') * 0.8)
    expect(first.classes()).toContain('cn')
    expect(second.classes()).toContain('cp')
    expect(second.classes()).not.toContain('cn')
  })

  it('renders provisional actions and points in a lighter style', () => {
    const actions = row(0).findAll('.ac-b')

    expect(actions.map((a) => [a.text(), a.classes().includes('provisional')])).toEqual([['指', false], ['换边', true]])
    expect(row(0).find('.lane.qg .pt').classes()).toContain('provisional')
    expect(row(0).find('.lane.ac .pt').classes()).not.toContain('provisional')
  })

  it('leaves a marked blank where a character was excluded', () => {
    const gone = row(2).find('.gone')

    expect(gone.attributes('title')).toContain('哭？')
    expect(gone.attributes('title')).toContain('用户决定删除')
    expect(gone.text()).toBe('')
    expect(wrapper.findAll('.gone')).toHaveLength(1)
  })

  it('omits lanes that have nothing in a row', () => {
    expect(row(2).find('.lane.gc').exists()).toBe(false)
    expect(row(2).find('.lane.qg').exists()).toBe(false)
  })
})

describe('PhraseFlow seeking', () => {
  const seeks = [
    ['a character', () => char(0, '思'), 12],
    ['a gongche note', () => row(0).findAll('.nt')[1], 10.5],
    ['a qiangge block, using its original start', () => row(1).find('.qg-b'), 12.5],
    ['a breath point', () => row(0).find('.bp'), 17.5],
    ['an action block', () => row(0).findAll('.ac-b')[1], 11],
    ['an action point', () => row(0).find('.lane.ac .pt'), 10.2],
    ['a qiangge point', () => row(0).find('.lane.qg .pt'), 11.5],
  ]

  it.each(seeks)('seeks when clicking %s', async (_, target, time) => {
    await target().trigger('click')

    expect(clock.getTime()).toBe(time)
  })
})

describe('PhraseFlow track toggles', () => {
  const box = (key) => wrapper.find(`input[data-track="${key}"]`)

  it('offers four toggles, all on by default', () => {
    expect(wrapper.findAll('input[data-track]').map((b) => [b.attributes('data-track'), b.element.checked])).toEqual([
      ['gongche', true], ['qiangge', true], ['breath', true], ['action', true],
    ])
  })

  it.each([
    ['gongche', '.lane.gc'], ['qiangge', '.lane.qg'], ['breath', '.lane.br'], ['action', '.lane.ac'],
  ])('hides the %s lane when switched off', async (key, lane) => {
    expect(wrapper.find(lane).exists()).toBe(true)

    await box(key).setValue(false)

    expect(wrapper.find(lane).exists()).toBe(false)
    expect(wrapper.find('.lane.ly').exists()).toBe(true)
  })

  it('remembers the toggles across reloads', async () => {
    await box('gongche').setValue(false)
    wrapper.unmount()

    wrapper = mount(PhraseFlow, { attachTo: document.body })

    expect(box('gongche').element.checked).toBe(false)
    expect(box('qiangge').element.checked).toBe(true)
    expect(wrapper.find('.lane.gc').exists()).toBe(false)
  })
})

describe('PhraseFlow playback position', () => {
  it('highlights the current row and character', async () => {
    clock.seek(21.5)
    await nextTick()

    expect(wrapper.findAll('.row.on').map((r) => r.attributes('data-i'))).toEqual(['1'])
    expect(wrapper.findAll('.ch.on').map((c) => c.text())).toEqual(['线'])
  })

  it('keeps the highlight when a toggle re-renders the view', async () => {
    clock.seek(21.5)
    await nextTick()
    await wrapper.find('input[data-track="breath"]').setValue(false)

    expect(wrapper.findAll('.row.on')).toHaveLength(1)
    expect(wrapper.findAll('.ch.on').map((c) => c.text())).toEqual(['线'])
  })

  it('shows the playhead only in the current row, at the current time', async () => {
    clock.seek(22)
    await nextTick()
    const heads = wrapper.findAll('.ph')
    const xian = char(1, '线')

    expect(heads.map((h) => h.element.hidden)).toEqual([true, false, true, true])
    const x = parseFloat(heads[1].element.style.transform.match(/translateX\(([\d.]+)px\)/)[1])
    expect(x).toBeCloseTo(px(xian, 'left') + px(xian, 'width') / 2, 3)
  })

  it('scrolls the current row into view when it changes', async () => {
    Element.prototype.scrollIntoView.mockClear()
    clock.seek(30.5)
    await nextTick()

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    expect(Element.prototype.scrollIntoView.mock.contexts.at(-1)).toBe(row(2).element)
  })
})

describe('PhraseFlow in English', () => {
  beforeEach(async () => {
    i18n.setLang('en', null)
    await nextTick()
  })

  it('translates the heading, the hint and the track toggles', () => {
    expect(wrapper.find('.flow-hd h3').text()).toBe('Duration layout')
    expect(wrapper.findAll('.tg').map((w) => w.text())).toEqual(['Gongche', 'Ornaments', 'Breath', 'Movement'])
  })

  it('labels rows with pinyin qupai or Sung / Spoken', () => {
    expect(wrapper.findAll('.row').map((r) => r.find('.row-nm').text())).toEqual(['Lǎn Huà Méi', '', 'Spoken', 'Sung'])
  })

  it('shows ornaments as pinyin with an English gloss on hover', () => {
    const block = row(0).find('.qg-b')

    expect(block.text()).toBe('sǒu-qiāng')
    expect(block.attributes('title')).toBe('sǒu-qiāng (tremolo ornament)')
    expect(row(0).find('.lane.qg .pt').attributes('title')).toBe('dǎ-yīn (tapped grace note) (provisional track)')
  })

  it('keeps lyrics, movement blocks and movement points in Chinese', () => {
    expect(row(0).findAll('.ch').map((c) => c.text()).join('')).toBe('但觉思情')
    expect(row(0).findAll('.ac-b').map((a) => a.text())).toEqual(['指', '换边'])
    expect(row(0).find('.lane.ac .pt').attributes('title')).toBe('相')
  })

  it('gives the reason for an excluded character in English', () => {
    expect(row(2).find('.gone').attributes('title')).toBe('Excluded "哭？" (0:33–0:36): Removed by the editor')
  })

  it('explains variant and padding characters in English', () => {
    expect(char(0, '思').attributes('title')).toBe('Performed "思"; the libretto has "情"')
    expect(char(1, '啊').attributes('title')).toBe('"啊" is not in the libretto (padding syllable)')
    expect(char(0, '但').attributes('title')).toBe('但 · sung')
  })
})
