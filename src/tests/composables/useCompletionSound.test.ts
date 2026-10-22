// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { completionCue, useCompletionSound } from '../../composables/useCompletionSound'
import { buildConfiguration, defaultSettings } from '../../domain/settings'

afterEach(() => vi.unstubAllGlobals())

describe('recorded completion cues', () => {
  it('chooses short-break, long-break and study recordings from the sequence', () => {
    const sessions = buildConfiguration(defaultSettings)
    if (typeof sessions === 'number') throw new Error('Expected sequence')
    expect(completionCue(sessions, 0)).toBe('break')
    expect(completionCue(sessions, 6)).toBe('completed')
    expect(completionCue(sessions, 1)).toBe('study')
    expect(completionCue(sessions, 7)).toBe('study')
    expect(completionCue([], 0)).toBe('completed')
  })

  it('preloads once, tracks actual playback ending, and cancels overlapping cues', async () => {
    const makeSource = () => ({ buffer: null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null })
    const sources: ReturnType<typeof makeSource>[] = []
    const context = {
      state: 'running', destination: {}, resume: vi.fn(async () => {}), close: vi.fn(async () => {}),
      decodeAudioData: vi.fn(async () => ({ duration: 3 })),
      createBufferSource: () => { const source = makeSource(); sources.push(source); return source },
    }
    const fetchAudio = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }))
    vi.stubGlobal('fetch', fetchAudio)
    vi.stubGlobal('AudioContext', vi.fn(function () { return context }))
    let sound!: ReturnType<typeof useCompletionSound>
    const wrapper = mount(defineComponent({ setup() { sound = useCompletionSound(); return () => null } }))
    await sound.unlock()
    await sound.unlock()
    expect(fetchAudio).toHaveBeenCalledTimes(3)
    await sound.play('break')
    expect(sound.playing.value).toBe(true)
    expect(sources[0]!.start).toHaveBeenCalledOnce()
    await sound.play('study')
    expect(sources[0]!.stop).toHaveBeenCalledOnce()
    expect(sources[0]!.disconnect).toHaveBeenCalledOnce()
    sources[1]!.onended?.()
    expect(sound.playing.value).toBe(false)
    await sound.play('completed')
    wrapper.unmount()
    expect(sources[2]!.stop).toHaveBeenCalledOnce()
    expect(context.close).toHaveBeenCalledOnce()
  })

  it('does not start a cue canceled during loading and recovers from unavailable audio', async () => {
    let resolveAudio!: (data: ArrayBuffer) => void
    const downloaded = new Promise<ArrayBuffer>(resolve => { resolveAudio = resolve })
    const context = {
      state: 'running', resume: vi.fn(async () => {}), close: vi.fn(async () => {}),
      decodeAudioData: vi.fn(async () => ({})), createBufferSource: vi.fn(),
    }
    vi.stubGlobal('AudioContext', vi.fn(function () { return context }))
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: () => downloaded })))
    let sound!: ReturnType<typeof useCompletionSound>
    const wrapper = mount(defineComponent({ setup() { sound = useCompletionSound(); return () => null } }))
    // Start unlocking without waiting for downloads; cancel a pending cue.
    void sound.unlock()
    await Promise.resolve()
    const pending = sound.play('break')
    await Promise.resolve()
    sound.stop()
    resolveAudio(new ArrayBuffer(4))
    await pending
    expect(context.createBufferSource).not.toHaveBeenCalled()
    expect(sound.playing.value).toBe(false)
    wrapper.unmount()
  })

  it('keeps the timer usable when browser audio is unavailable', async () => {
    vi.stubGlobal('AudioContext', vi.fn(function () { throw new Error('Audio unavailable') }))
    let sound!: ReturnType<typeof useCompletionSound>
    const wrapper = mount(defineComponent({ setup() { sound = useCompletionSound(); return () => null } }))
    await expect(sound.unlock()).resolves.toBeUndefined()
    await expect(sound.play()).resolves.toBeUndefined()
    expect(sound.playing.value).toBe(false)
    wrapper.unmount()
  })
})
