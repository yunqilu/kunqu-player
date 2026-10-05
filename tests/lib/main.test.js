// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  document.body.innerHTML = '<div id="app"></div>'
})
afterEach(() => vi.unstubAllGlobals())

it('shows the backend message instead of a blank page when loading fails', async () => {
  vi.stubGlobal('fetch', async () => ({
    ok: false,
    status: 500,
    json: async () => ({ detail: '断句失败：尾段文字与 overrides 不一致' }),
  }))

  await expect(import('../../src/main.js')).rejects.toThrow('断句失败')

  const box = document.querySelector('#app .load-error')
  expect(box.textContent).toBe('断句失败：尾段文字与 overrides 不一致')
})

it('tells the user to start the backend when it cannot be reached', async () => {
  vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch') })

  await expect(import('../../src/main.js')).rejects.toThrow()

  expect(document.querySelector('#app .load-error').textContent).toMatch(/连不上后端.*make up/)
})
