import { afterEach, expect, it, vi } from 'vitest'
import handler from '../../../netlify/functions/music-title'

afterEach(() => vi.unstubAllGlobals())
const request = (link: string) => new Request(`https://timer.example/.netlify/functions/music-title?url=${encodeURIComponent(link)}`)

it('fetches only validated YouTube metadata and trims the displayed title', async () => {
  const fetchTitle = vi.fn(async (_url: string | URL | Request) => Response.json({ title: '  Artist - Song title  ' }))
  vi.stubGlobal('fetch', fetchTitle)
  expect(await (await handler(request('https://youtu.be/abcdefghijk'))).json()).toEqual({ title: 'Artist - Song title' })
  const endpoint = new URL(String(fetchTitle.mock.calls[0]![0]))
  expect(endpoint.origin).toBe('https://www.youtube.com')
  expect(endpoint.pathname).toBe('/oembed')
  expect(endpoint.searchParams.get('url')).toBe('https://www.youtube.com/watch?v=abcdefghijk')
  expect((await handler(request('https://evil.example/song'))).status).toBe(400)
  expect(fetchTitle).toHaveBeenCalledOnce()
})

it('allows saving without metadata when a video is unavailable or the service fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Offline') }))
  expect(await (await handler(request('https://youtu.be/abcdefghijk'))).json()).toEqual({ title: '' })
})
