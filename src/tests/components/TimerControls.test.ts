// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import TimerControls from '../../components/TimerControls.vue'

enableAutoUnmount(afterEach)

describe('TimerControls', () => {
  it('emits start when the idle start button is clicked', async () => {
    const wrapper = mount(TimerControls, { props: { isRunning: false } })
    await wrapper.get('[data-testid="start-button"]').trigger('click')
    expect(wrapper.emitted('start')).toHaveLength(1)
  })

  it('emits pause when the running pause button is clicked', async () => {
    const wrapper = mount(TimerControls, { props: { isRunning: true } })
    await wrapper.get('[data-testid="pause-button"]').trigger('click')
    expect(wrapper.emitted('pause')).toHaveLength(1)
  })

  it('emits reset when the reset button is clicked', async () => {
    const wrapper = mount(TimerControls, { props: { isRunning: true } })
    await wrapper.get('[data-testid="reset-button"]').trigger('click')
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })
})
