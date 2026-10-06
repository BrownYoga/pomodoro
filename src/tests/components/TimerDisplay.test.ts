// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import TimerDisplay from '../../components/TimerDisplay.vue'

enableAutoUnmount(afterEach)

describe('TimerDisplay', () => {
  it('displays the supplied formatted value', () => {
    const wrapper = mount(TimerDisplay, { props: { value: '01:05' } })
    expect(wrapper.get('[data-testid="timer-display"]').text()).toBe('01:05')
  })
})
