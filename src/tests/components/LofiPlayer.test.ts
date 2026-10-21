// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import LofiPlayer from '../../components/LofiPlayer.vue'
import App from '../../App.vue'
import type { YouTubePlayer, YouTubePlayerOptions } from '../../composables/useLofiPlayer'

enableAutoUnmount(afterEach)
let events: YouTubePlayerOptions['events']
let player: YouTubePlayer
const create = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  player = {
    playVideo: vi.fn(), pauseVideo: vi.fn(), destroy: vi.fn(),
    setVolume: vi.fn(), getDuration: vi.fn(() => 1000), seekTo: vi.fn(),
  }
  create.mockReset()
  window.YT = { Player: vi.fn(function (_element: HTMLElement, options: YouTubePlayerOptions) {
      create(options)
      events = options.events
      return player
    }) as unknown as NonNullable<typeof window.YT>['Player'] }
})
afterEach(() => { vi.useRealTimers(); delete window.YT })

async function play(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('[data-testid="lofi-play"]').trigger('click')
  await flushPromises()
  events.onReady({ target: player })
  events.onStateChange({ data: 1 })
  await flushPromises()
}

describe('optional lo-fi player', () => {
  it('is inactive and has no player or API load by default', () => {
    const wrapper = mount(LofiPlayer)
    expect(wrapper.find('[data-testid="lofi-panel"]').exists()).toBe(false)
    expect(create).not.toHaveBeenCalled()
    expect(document.querySelector('script[src="https://www.youtube.com/iframe_api"]')).toBeNull()
  })

  it('reveals the player, requests playback, pauses, resumes near the live edge and adjusts volume', async () => {
    const wrapper = mount(LofiPlayer)
    await play(wrapper)
    expect(wrapper.get('[data-testid="lofi-panel"]').isVisible()).toBe(true)
    expect(player.playVideo).toHaveBeenCalledOnce()
    expect(player.seekTo).toHaveBeenCalledWith(1000, true)
    await wrapper.get('[data-testid="lofi-pause"]').trigger('click')
    expect(player.pauseVideo).toHaveBeenCalledOnce()
    events.onStateChange({ data: 2 })
    await flushPromises()
    vi.mocked(player.getDuration).mockReturnValue(1200)
    await wrapper.get('[data-testid="lofi-play"]').trigger('click')
    expect(player.seekTo).toHaveBeenLastCalledWith(1200, true)
    expect(player.playVideo).toHaveBeenCalledTimes(2)
    await wrapper.get('input[type="range"]').setValue('35')
    expect(player.setVolume).toHaveBeenLastCalledWith(35)
    expect(wrapper.text()).not.toContain('LIVE')
  })

  it('destroys playback before collapsing and ignores late events', async () => {
    const wrapper = mount(LofiPlayer)
    await play(wrapper)
    await wrapper.get('[data-testid="lofi-stop"]').trigger('click')
    expect(player.destroy).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="lofi-panel"]').exists()).toBe(false)
    events.onStateChange({ data: 1 })
    await flushPromises()
    expect(wrapper.find('[data-testid="lofi-panel"]').exists()).toBe(false)
  })

  it('cancels initialization when stopped before the API is ready', async () => {
    const api = window.YT
    delete window.YT
    const wrapper = mount(LofiPlayer)
    await wrapper.get('[data-testid="lofi-play"]').trigger('click')
    await wrapper.get('[data-testid="lofi-stop"]').trigger('click')
    window.YT = api
    window.onYouTubeIframeAPIReady?.()
    await flushPromises()
    expect(create).not.toHaveBeenCalled()
    document.querySelector('script[src="https://www.youtube.com/iframe_api"]')?.remove()
  })

  it('offers a visible playback fallback when autoplay is blocked', async () => {
    const wrapper = mount(LofiPlayer)
    await play(wrapper)
    events.onAutoplayBlocked()
    await flushPromises()
    expect(wrapper.text()).toContain('Press play in the YouTube player')
    expect(wrapper.find('[data-testid="lofi-panel"]').exists()).toBe(true)
  })

  it('cleans up on unmount', async () => {
    const wrapper = mount(LofiPlayer)
    await play(wrapper)
    wrapper.unmount()
    expect(player.destroy).toHaveBeenCalledOnce()
  })

  it('keeps music independent of timer start, pause, resume, reset, completion and YouTube errors', async () => {
    const wrapper = mount(App)
    await play(wrapper)
    await wrapper.get('[data-testid="start-button"]').trigger('click')
    await wrapper.get('[data-testid="pause-button"]').trigger('click')
    await wrapper.get('[data-testid="start-button"]').trigger('click')
    await wrapper.get('[data-testid="reset-button"]').trigger('click')
    await wrapper.get('[data-testid="start-button"]').trigger('click')
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    expect(wrapper.get('[data-testid="completed-count"]').text()).toBe('1')
    expect(player.playVideo).toHaveBeenCalledOnce()
    expect(player.pauseVideo).not.toHaveBeenCalled()
    expect(player.destroy).not.toHaveBeenCalled()
    events.onError({ data: 101 })
    await flushPromises()
    expect(wrapper.text()).toContain('cannot be played here')
    await wrapper.get('[data-testid="start-button"]').trigger('click')
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.get('[data-testid="timer-display"]').text()).toBe('04:59')
  })
})
