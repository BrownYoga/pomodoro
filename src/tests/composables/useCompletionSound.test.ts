// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useCompletionSound } from '../../composables/useCompletionSound'

afterEach(() => vi.unstubAllGlobals())

describe('completion gong', () => {
  it('unlocks on demand, plays a sustained metallic strike, and cleans up overlapping strikes', async () => {
    const oscillators: any[] = []
    const gains: any[] = []
    const context = {
      state: 'suspended', currentTime: 10, destination: {},
      resume: vi.fn(async () => { context.state = 'running' }), close: vi.fn(async () => {}),
      createOscillator: () => {
        const oscillator = { frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: () => {} }
        oscillators.push(oscillator)
        return oscillator
      },
      createGain: () => {
        const gain = { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }
        gains.push(gain)
        return gain
      },
    }
    const Audio = vi.fn(function () { return context })
    vi.stubGlobal('AudioContext', Audio)
    let sound!: ReturnType<typeof useCompletionSound>
    const wrapper = mount(defineComponent({ setup() { sound = useCompletionSound(); return () => null } }))
    sound.play()
    expect(Audio).not.toHaveBeenCalled()
    await sound.unlock()
    sound.play()
    expect(oscillators).toHaveLength(6)
    const peak = gains.reduce((sum, gain) => sum + gain.gain.linearRampToValueAtTime.mock.calls[0][0], 0)
    expect(peak).toBeGreaterThan(0.7)
    expect(peak).toBeLessThan(1)
    expect(oscillators[0].stop).toHaveBeenCalledWith(14.55)
    sound.play()
    for (const oscillator of oscillators.slice(0, 6)) {
      expect(oscillator.stop).toHaveBeenLastCalledWith()
      oscillator.onended()
      expect(oscillator.disconnect).toHaveBeenCalledOnce()
    }
    wrapper.unmount()
    expect(context.close).toHaveBeenCalledOnce()
    for (const oscillator of oscillators.slice(6)) expect(oscillator.stop).toHaveBeenLastCalledWith()
  })

  it('keeps the timer usable when browser audio is unavailable', async () => {
    vi.stubGlobal('AudioContext', vi.fn(function () { throw new Error('Audio unavailable') }))
    let sound!: ReturnType<typeof useCompletionSound>
    const wrapper = mount(defineComponent({ setup() { sound = useCompletionSound(); return () => null } }))
    await expect(sound.unlock()).resolves.toBeUndefined()
    expect(() => sound.play()).not.toThrow()
    wrapper.unmount()
  })
})
