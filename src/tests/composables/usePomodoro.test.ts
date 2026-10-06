// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { usePomodoro } from '../../composables/usePomodoro'

// Define the composable API once session configuration/state are decided.
// Use fake timers and mount a host component when testing lifecycle hooks.
describe('usePomodoro', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it.todo('exposes reactive state initialized from session configuration')
  it('counts down from 10 to 9 seconds one second after starting', async () => {
    let timer!: ReturnType<typeof usePomodoro>

    // A host component allows future lifecycle hooks to run normally.
    wrapper = mount(defineComponent({
      setup() {
        timer = usePomodoro(10)
        return () => null
      },
    }))

    expect(timer.remainingSeconds.value).toBe(10)
    timer.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(timer.remainingSeconds.value).toBe(9)
  })
  it.todo('pauses the clock and resumes from the remaining time')
  it.todo('resets according to the chosen reset behaviour')
  it.todo('delegates session transitions and completed focus counting to the domain')
  it.todo('cleans up the clock when its component unmounts')
})
