import { describe, expect, it, vi } from 'vitest'
import { probeVideo, videoUrl } from '../../src/lib/video.js'

describe('videoUrl', () => {
  it('points at the video route of the piece', () => {
    expect(videoUrl('xunmeng')).toBe('/api/pieces/xunmeng/video')
  })
})

describe('probeVideo', () => {
  it('asks with HEAD so the file is not downloaded twice', async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 200 }))

    await probeVideo('xunmeng', fetch)

    expect(fetch).toHaveBeenCalledWith('/api/pieces/xunmeng/video', { method: 'HEAD' })
  })

  it('returns the URL when the backend has the video', async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 200 }))

    expect(await probeVideo('xunmeng', fetch)).toBe('/api/pieces/xunmeng/video')
  })

  it('returns null when the video is missing', async () => {
    const fetch = vi.fn(async () => ({ ok: false, status: 404 }))

    expect(await probeVideo('xunmeng', fetch)).toBeNull()
  })

  it('returns null when the backend cannot be reached', async () => {
    const fetch = vi.fn(async () => { throw new TypeError('Failed to fetch') })

    expect(await probeVideo('xunmeng', fetch)).toBeNull()
  })
})
