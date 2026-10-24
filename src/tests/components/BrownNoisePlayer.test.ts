// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import BrownNoisePlayer from '../../components/BrownNoisePlayer.vue'
import { brownNoiseSamples } from '../../composables/useBrownNoise'

enableAutoUnmount(afterEach)
const source = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null, loop: false }
const param = { value: 0, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }
const gain = { gain: param, connect: vi.fn(), disconnect: vi.fn() }
const audio = {
  state: 'running', sampleRate: 1000, currentTime: 0, destination: {},
  resume: vi.fn(async () => {}), close: vi.fn(async () => {}),
  createBuffer: vi.fn((_channels: number, length: number, rate: number) => ({ duration: length / rate, getChannelData: () => new Float32Array(length) })),
  createGain: vi.fn(() => gain), createBufferSource: vi.fn(() => source),
}
beforeEach(() => {
  vi.clearAllMocks()
  audio.resume.mockResolvedValue(undefined)
  vi.stubGlobal('AudioContext', vi.fn(function () { return audio }))
})
afterEach(() => vi.unstubAllGlobals())

it('creates audio only on request, pauses, resumes, changes volume and cleans up', async () => {
  const wrapper = mount(BrownNoisePlayer)
  expect(AudioContext).not.toHaveBeenCalled()
  await wrapper.get('[data-testid="brown-noise"]').trigger('click')
  await flushPromises()
  expect(source.start).toHaveBeenCalledOnce()
  expect(source.loop).toBe(true)
  expect(wrapper.emitted('activate')).toHaveLength(1)
  await wrapper.get('#brown-volume').setValue('55')
  expect(param.linearRampToValueAtTime).toHaveBeenLastCalledWith(.55, .03)
  await wrapper.get('[data-testid="brown-noise"]').trigger('click')
  expect(source.stop).toHaveBeenCalledOnce()
  await wrapper.get('[data-testid="brown-noise"]').trigger('click')
  await flushPromises()
  expect(source.start).toHaveBeenCalledTimes(2)
  expect(audio.createBuffer).toHaveBeenCalledOnce()
  wrapper.unmount()
  expect(source.stop).toHaveBeenCalledTimes(2)
  expect(audio.close).toHaveBeenCalledOnce()
})

it('quiets voice cues, preserves volume edits, and resumes only previously playing noise after breaks', async () => {
  const wrapper = mount(BrownNoisePlayer, { props: { fadeQuiet: true } })
  await wrapper.get('[data-testid="brown-noise"]').trigger('click')
  await flushPromises()
  await wrapper.setProps({ quiet: true })
  expect(param.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 1)
  await wrapper.get('#brown-volume').setValue('65')
  expect(param.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, .03)
  await wrapper.setProps({ quiet: false })
  expect(param.linearRampToValueAtTime).toHaveBeenLastCalledWith(.65, 1)
  await wrapper.setProps({ isRest: true })
  expect(audio.close).toHaveBeenCalledOnce()
  expect(wrapper.find('#brown-noise-panel').exists()).toBe(false)
  await wrapper.setProps({ isRest: false, focusRunning: true })
  await flushPromises()
  expect(source.start).toHaveBeenCalledTimes(2)
  await wrapper.get('[data-testid="brown-noise"]').trigger('click')
  await wrapper.setProps({ isRest: true, focusRunning: false })
  await wrapper.setProps({ isRest: false, focusRunning: true })
  expect(source.start).toHaveBeenCalledTimes(2)
})

it('cancels pending audio startup on close and offers a retry when audio fails', async () => {
  let finish!: () => void
  audio.resume.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
  const wrapper = mount(BrownNoisePlayer)
  await wrapper.get('[data-testid="brown-noise"]').trigger('click')
  await wrapper.get('[aria-label="Stop brown noise and close player"]').trigger('click')
  finish()
  await flushPromises()
  expect(source.start).not.toHaveBeenCalled()
  audio.resume.mockRejectedValueOnce(new Error('Blocked'))
  await wrapper.get('[data-testid="brown-noise"]').trigger('click')
  await flushPromises()
  expect(wrapper.get('[role="status"]').text()).toContain('could not start')
  await wrapper.get('[data-testid="brown-noise"]').trigger('click')
  await flushPromises()
  expect(source.start).toHaveBeenCalledOnce()
})

it('generates finite, bounded low-frequency noise with a smooth loop boundary', () => {
  const { samples, loopStart } = brownNoiseSamples(44100, 1)
  expect(samples).toHaveLength(44100)
  expect(samples.every(value => Number.isFinite(value) && Math.abs(value) <= 3.5)).toBe(true)
  const jump = Math.abs(samples.at(-1)! - samples[Math.round(loopStart * 44100)]!)
  expect(jump).toBeLessThan(.15)
  let energy = 0
  let difference = 0
  for (let i = 1; i < samples.length; i++) {
    energy += samples[i]! ** 2
    difference += (samples[i]! - samples[i - 1]!) ** 2
  }
  expect(energy).toBeGreaterThan(0)
  expect(difference / energy).toBeLessThan(.15)
})
