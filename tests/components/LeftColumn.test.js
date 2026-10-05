// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { outlineModel } from '../lib/outline.fixture.js'

let wrapper, clock, i18n

beforeAll(async () => {
  Element.prototype.scrollIntoView = vi.fn()
  // 与 main.js 相同的次序：先填 model，再 import 会读它的模块
  i18n = await import('../../src/i18n/index.js')
  i18n.setLang('zh', null) // 这些断言写的是中文界面；英文见最后一组
  const { model } = await import('../../src/lib/model.js')
  Object.assign(model, outlineModel())
  clock = (await import('../../src/composables/useClock.js')).clock
  const { default: LeftColumn } = await import('../../src/components/LeftColumn.vue')
  wrapper = mount(LeftColumn)
})

const item = (text) => wrapper.findAll('.rail-item').find((w) => w.find('.rx').text() === text)

describe('LeftColumn outline', () => {
  it('shows a heading per section with phrase and inferred counts', () => {
    const heads = wrapper.findAll('.sec-hd').map((w) => [w.find('.sec-nm').text(), w.find('.sec-ct').text()])

    expect(heads).toEqual([['【懒画眉】', '2 句'], ['白', '1 句'], ['唱', '2 句 · 推定 2']])
  })

  it('lists every phrase once, in order, keyed by its line index', () => {
    const rows = wrapper.findAll('.rail-item')

    expect(rows.map((w) => w.find('.rx').text())).toEqual([
      '一径行来', '但觉思情辗转', '昨日梦里', '少不得楼上花枝', '也则是照独眠',
    ])
    expect(rows.map((w) => w.attributes('data-i'))).toEqual(['0', '1', '2', '3', '4'])
  })

  it('marks inferred phrases and exposes their evidence on hover', () => {
    const row = item('少不得楼上花枝')

    expect(row.classes()).toContain('inferred')
    expect(row.attributes('title')).toContain('推定断句，依据：')
    expect(row.attributes('title')).toContain('句后停顿 0.00 秒')
    expect(item('一径行来').classes()).not.toContain('inferred')
  })

  it('flags variant phrases and lists the differences on hover', () => {
    const row = item('但觉思情辗转')

    expect(row.find('.mark').text()).toBe('异')
    expect(row.attributes('title')).toContain('演出「思」，歌词作「情」')
    expect(item('一径行来').find('.mark').exists()).toBe(false)
  })

  it('seeks to the phrase and highlights it when clicked', async () => {
    await item('昨日梦里').trigger('click')
    await nextTick()

    expect(clock.getTime()).toBe(30)
    expect(wrapper.findAll('.rail-item.on').map((w) => w.find('.rx').text())).toEqual(['昨日梦里'])
  })
})

describe('LeftColumn in English', () => {
  it('switches headings, counts and marks without touching the lyrics', async () => {
    i18n.setLang('en', null)
    await nextTick()

    const heads = wrapper.findAll('.sec-hd').map((w) => [w.find('.sec-nm').text(), w.find('.sec-ct').text()])
    expect(heads).toEqual([['Lǎn Huà Méi', '2 phrases'], ['Spoken', '1 phrase'], ['Sung', '2 phrases · 2 inferred']])
    expect(wrapper.find('.sec-nm').attributes('title')).toBe('qupai — a named tune pattern')
    expect(wrapper.find('.rail-hd').text()).toBe('Qupai · phrases · click to jump')
    expect(wrapper.find('.ttl').text()).toBe('The Peony Pavilion · Seeking the Dream')
    expect(item('但觉思情辗转').find('.mark').text()).toBe('var')
    expect(item('但觉思情辗转').attributes('title')).toContain('Variant wording')
    expect(item('少不得楼上花枝').attributes('title')).toContain('Inferred phrase break. Evidence:\nMeaning: a complete clause')
    expect(item('一径行来').attributes('title')).toContain('From lyrics')
    expect(item('一径行来').attributes('title')).toBe('0:10 一径行来\nI have walked the whole path here,\nFrom lyrics')

    i18n.setLang('zh', null)
    await nextTick()
    expect(wrapper.find('.sec-nm').text()).toBe('【懒画眉】')
  })
})
