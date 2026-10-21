// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

beforeEach(() => { vi.useFakeTimers(); vi.resetModules(); delete window.YT })
afterEach(() => {
  vi.useRealTimers()
  delete window.YT
  delete window.onYouTubeIframeAPIReady
  document.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]').forEach(script => script.remove())
})

it('shares one API script and preserves an existing ready callback', async () => {
  const previous = vi.fn()
  window.onYouTubeIframeAPIReady = previous
  const { loadYouTubeAPI } = await import('../../composables/useLofiPlayer')
  const first = loadYouTubeAPI()
  expect(loadYouTubeAPI()).toBe(first)
  expect(document.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]')).toHaveLength(1)
  window.YT = { Player: vi.fn() as unknown as NonNullable<typeof window.YT>['Player'] }
  window.onYouTubeIframeAPIReady?.()
  await expect(first).resolves.toBe(window.YT)
  expect(previous).toHaveBeenCalledOnce()
  expect(window.onYouTubeIframeAPIReady).toBe(previous)
  expect(vi.getTimerCount()).toBe(0)
})

it('recovers from script failure and allows retry', async () => {
  const { loadYouTubeAPI } = await import('../../composables/useLofiPlayer')
  const first = loadYouTubeAPI()
  const failed = expect(first).rejects.toThrow('YouTube could not load')
  document.querySelector('script')!.dispatchEvent(new Event('error'))
  await failed
  const retry = loadYouTubeAPI()
  const timeout = expect(retry).rejects.toThrow('YouTube could not load')
  await vi.advanceTimersByTimeAsync(15000)
  await timeout
  expect(document.querySelector('script')).toBeNull()
  expect(vi.getTimerCount()).toBe(0)
})
