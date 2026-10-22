// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import LofiPlayer from '../../components/LofiPlayer.vue'
import App from '../../App.vue'
import type { YouTubePlayer, YouTubePlayerOptions } from '../../composables/useLofiPlayer'
import { defaultSettings } from '../../domain/settings'

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

  it('silences music temporarily, preserves volume edits, and never resumes a manually paused player', async () => {
    const wrapper = mount(LofiPlayer)
    await play(wrapper)
    await wrapper.get('input[type="range"]').setValue('35')
    await wrapper.setProps({ quiet: true })
    expect(player.setVolume).toHaveBeenLastCalledWith(0)
    await wrapper.get('input[type="range"]').setValue('65')
    expect(player.setVolume).toHaveBeenLastCalledWith(0)
    await wrapper.get('[data-testid="lofi-pause"]').trigger('click')
    events.onStateChange({ data: 2 })
    await wrapper.setProps({ quiet: false })
    expect(player.setVolume).toHaveBeenLastCalledWith(65)
    expect(player.playVideo).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="lofi-play"]').text()).toContain('Resume')
    await wrapper.get('[data-testid="lofi-stop"]').trigger('click')
    await wrapper.setProps({ quiet: true })
    await wrapper.setProps({ quiet: false })
    expect(create).toHaveBeenCalledOnce()
    expect(player.playVideo).toHaveBeenCalledOnce()
  })

  it('fades down over a second and cancels the fade when quiet mode ends', async () => {
    const wrapper = mount(LofiPlayer, { props: { fadeQuiet: true } })
    await play(wrapper)
    await wrapper.setProps({ quiet: true })
    await vi.advanceTimersByTimeAsync(500)
    expect(player.setVolume).toHaveBeenLastCalledWith(25)
    await wrapper.setProps({ quiet: false })
    expect(player.setVolume).toHaveBeenLastCalledWith(50)
    await vi.advanceTimersByTimeAsync(1000)
    expect(player.setVolume).toHaveBeenLastCalledWith(50)
    await wrapper.setProps({ quiet: true })
    await vi.advanceTimersByTimeAsync(1000)
    expect(player.setVolume).toHaveBeenLastCalledWith(0)
  })

  it('applies silence when a player becomes ready during a voice cue', async () => {
    const wrapper = mount(LofiPlayer, { props: { quiet: true } })
    await play(wrapper)
    expect(player.setVolume).toHaveBeenLastCalledWith(0)
    await wrapper.setProps({ quiet: false })
    expect(player.setVolume).toHaveBeenLastCalledWith(50)
  })

  it('unlocks voice audio on a music interaction without requiring the timer Start button', async () => {
    localStorage.setItem('pomodoro-settings-v1', JSON.stringify({ ...defaultSettings, soundEnabled: true }))
    const audio = { resume: vi.fn(async () => {}), close: vi.fn(async () => {}) }
    vi.stubGlobal('AudioContext', vi.fn(function () { return audio }))
    const wrapper = mount(App)
    try {
      await wrapper.get('[data-testid="lofi-play"]').trigger('pointerdown')
      expect(audio.resume).toHaveBeenCalledOnce()
    } finally {
      wrapper.unmount()
      vi.unstubAllGlobals()
    }
  })

  it('closes music for a break and recreates it when focus automatically resumes', async () => {
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
    expect(player.destroy).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="lofi-panel"]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    await flushPromises()
    expect(create).toHaveBeenCalledTimes(2)
    events.onReady({ target: player })
    events.onStateChange({ data: 1 })
    await flushPromises()
    expect(player.playVideo).toHaveBeenCalledTimes(2)
    expect(player.seekTo).toHaveBeenLastCalledWith(1000, true)
    events.onError({ data: 101 })
    await flushPromises()
    expect(wrapper.text()).toContain('cannot be played here')
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.get('[data-testid="timer-display"]').text()).toBe('24:59')
  })
})


it.each(['pause', 'stop'] as const)('does not restart manually %s music after a break', async action => {
  const wrapper = mount(LofiPlayer)
  await play(wrapper)
  await wrapper.get('[data-testid="lofi-' + action + '"]').trigger('click')
  await wrapper.setProps({ isRest: true, focusRunning: false })
  await wrapper.setProps({ isRest: false, focusRunning: true })
  expect(create).toHaveBeenCalledOnce()
  expect(player.playVideo).toHaveBeenCalledOnce()
})

it('cancels loading on a break and waits for focus to run before creating a fresh player', async () => {
  const wrapper = mount(LofiPlayer)
  await wrapper.get('[data-testid="lofi-play"]').trigger('click')
  await flushPromises()
  const staleEvents = events
  await wrapper.setProps({ isRest: true })
  expect(player.destroy).toHaveBeenCalledOnce()
  expect(wrapper.get('[data-testid="lofi-play"]').attributes('disabled')).toBeDefined()
  staleEvents.onReady({ target: player })
  expect(player.playVideo).not.toHaveBeenCalled()
  await wrapper.setProps({ isRest: false, focusRunning: false })
  expect(create).toHaveBeenCalledOnce()
  await wrapper.setProps({ focusRunning: true })
  await flushPromises()
  expect(create).toHaveBeenCalledTimes(2)
  events.onReady({ target: player })
  expect(player.playVideo).toHaveBeenCalledOnce()
})
