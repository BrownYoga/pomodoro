// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, isRef } from 'vue'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { usePomodoro } from '../../composables/usePomodoro'
import type { SessionConfig, TimerContract } from '../contracts'

const createTimer = usePomodoro
const sessions: readonly SessionConfig[] = [
  { id: 'work', durationSeconds: 10, countsAsFocus: true },
  { id: 'rest', durationSeconds: 3, countsAsFocus: false },
]

describe('usePomodoro', () => {
  let wrapper: VueWrapper | undefined

  function mountTimer(configuration: number | readonly SessionConfig[] = 10) {
    let timer!: TimerContract
    wrapper = mount(defineComponent({
      setup() {
        timer = createTimer(configuration)
        return () => null
      },
    }))
    return timer
  }

  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('exposes reactive remaining time and starts idle', async () => {
    const timer = mountTimer()
    expect(isRef(timer.remainingSeconds)).toBe(true)
    expect(isRef(timer.isRunning)).toBe(true)
    expect(timer.remainingSeconds.value).toBe(10)
    expect(timer.isRunning.value).toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(timer.remainingSeconds.value).toBe(10)
  })

  it('counts down from 10 to 9 seconds one second after starting', async () => {
    const timer = mountTimer()
    expect(timer.remainingSeconds.value).toBe(10)
    timer.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(timer.remainingSeconds.value).toBe(9)
  })

  it('marks the timer as running after start', () => {
    const timer = mountTimer()
    timer.start()
    expect(timer.isRunning.value).toBe(true)
  })

  it('does not create duplicate clocks when start is called twice', async () => {
    const timer = mountTimer()
    timer.start()
    timer.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(timer.remainingSeconds.value).toBe(9)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('pauses without changing the remaining time', async () => {
    const timer = mountTimer()
    timer.start()
    await vi.advanceTimersByTimeAsync(1000)
    timer.pause()
    expect(timer.isRunning.value).toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(timer.remainingSeconds.value).toBe(9)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('resumes from the remaining time rather than restarting', async () => {
    const timer = mountTimer()
    timer.start()
    await vi.advanceTimersByTimeAsync(1000)
    timer.pause()
    await vi.advanceTimersByTimeAsync(2000)
    timer.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(timer.remainingSeconds.value).toBe(8)
    expect(timer.isRunning.value).toBe(true)
  })

  it('restores the supplied duration and stops when reset while running', async () => {
    const timer = mountTimer()
    timer.start()
    await vi.advanceTimersByTimeAsync(2000)
    timer.reset()
    expect(timer.remainingSeconds.value).toBe(10)
    expect(timer.isRunning.value).toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(timer.remainingSeconds.value).toBe(10)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('restores the duration when reset while paused', async () => {
    const timer = mountTimer()
    timer.start()
    await vi.advanceTimersByTimeAsync(1000)
    timer.pause()
    timer.reset()
    expect(timer.remainingSeconds.value).toBe(10)
    expect(timer.isRunning.value).toBe(false)
  })

  it('stops at zero for a standalone numeric duration', async () => {
    const timer = mountTimer(2)
    timer.start()
    await vi.advanceTimersByTimeAsync(5000)
    expect(timer.remainingSeconds.value).toBe(0)
    expect(timer.isRunning.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('initializes reactive session state from the supplied configuration', () => {
    const timer = mountTimer(sessions)
    expect(isRef(timer.activeSessionId)).toBe(true)
    expect(isRef(timer.completedFocusSessions)).toBe(true)
    expect(timer.activeSessionId.value).toBe('work')
    expect(timer.remainingSeconds.value).toBe(10)
    expect(timer.completedFocusSessions.value).toBe(0)
  })

  it('prepares the next configured session and counts a completed focus', async () => {
    const timer = mountTimer(sessions)
    timer.start()
    await vi.advanceTimersByTimeAsync(10000)
    expect(timer.activeSessionId.value).toBe('rest')
    expect(timer.remainingSeconds.value).toBe(3)
    expect(timer.completedFocusSessions.value).toBe(1)
    expect(timer.isRunning.value).toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(timer.remainingSeconds.value).toBe(3)
  })

  it('does not count a completed rest as focus and wraps the configured sequence', async () => {
    const timer = mountTimer(sessions)
    timer.start()
    await vi.advanceTimersByTimeAsync(10000)
    timer.start()
    await vi.advanceTimersByTimeAsync(3000)
    expect(timer.activeSessionId.value).toBe('work')
    expect(timer.remainingSeconds.value).toBe(10)
    expect(timer.completedFocusSessions.value).toBe(1)
    expect(timer.isRunning.value).toBe(false)
  })

  it('resets the current configured session without erasing completed focus count', async () => {
    const timer = mountTimer(sessions)
    timer.start()
    await vi.advanceTimersByTimeAsync(10000)
    timer.start()
    await vi.advanceTimersByTimeAsync(1000)
    timer.reset()
    expect(timer.activeSessionId.value).toBe('rest')
    expect(timer.remainingSeconds.value).toBe(3)
    expect(timer.completedFocusSessions.value).toBe(1)
    expect(timer.isRunning.value).toBe(false)
  })

  it('cleans up the clock when its component unmounts', async () => {
    const timer = mountTimer()
    timer.start()
    await vi.advanceTimersByTimeAsync(1000)
    wrapper!.unmount()
    wrapper = undefined
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(2000)
    expect(timer.remainingSeconds.value).toBe(9)
  })

  it('uses elapsed time when browser callbacks are delayed', async () => {
    const timer = mountTimer()
    timer.start()
    vi.setSystemTime(Date.now() + 5000)
    await vi.advanceTimersByTimeAsync(250)
    expect(timer.remainingSeconds.value).toBe(5)
  })

  it('preserves partial seconds across pause and resume', async () => {
    const timer = mountTimer()
    timer.start()
    await vi.advanceTimersByTimeAsync(500)
    timer.pause()
    await vi.advanceTimersByTimeAsync(5000)
    timer.start()
    await vi.advanceTimersByTimeAsync(500)
    expect(timer.remainingSeconds.value).toBe(9)
  })
})
