import { describe, expect, it } from 'vitest'
import { applyTimerCommand, freshTimer, isSharedTimerState, reconcileTimer } from '../../domain/sharedTimer'
import { defaultSettings } from '../../domain/settings'

describe('shared timer rules', () => {
  it('stores a deadline and preserves fractional seconds through pause and resume', () => {
    const started = applyTimerCommand(freshTimer(), { type: 'start' }, 1000)
    expect(started.endsAt).toBe(1501000)
    const paused = applyTimerCommand(started, { type: 'pause' }, 2250)
    expect(paused.remainingMilliseconds).toBe(1498750)
    expect(paused.endsAt).toBeNull()
    const resumed = applyTimerCommand(paused, { type: 'start' }, 10000)
    expect(resumed.endsAt).toBe(1508750)
  })
  it('completes an expired focus once and prepares rest without starting it', () => {
    const running = applyTimerCommand(freshTimer(), { type: 'start' }, 0)
    const completed = reconcileTimer(running, 2000000)
    expect(completed).toMatchObject({ status: 'ready', endsAt: null, sessionIndex: 1,
      remainingMilliseconds: 300000, completedFocusSessions: 1 })
    expect(reconcileTimer(completed, 3000000)).toBe(completed)
    expect(running.completedFocusSessions).toBe(0)
  })
  it('finishes standalone focus and preserves completed count on reset', () => {
    const running = applyTimerCommand(freshTimer({ ...defaultSettings, breaksEnabled: false }), { type: 'start' }, 0)
    const completed = reconcileTimer(running, 1500000)
    expect(completed.status).toBe('finished')
    expect(completed.completedFocusSessions).toBe(1)
    expect(applyTimerCommand(completed, { type: 'reset' }, 1500000)).toMatchObject({ status: 'ready', remainingMilliseconds: 1500000, completedFocusSessions: 1 })
  })
  it('resets the current rest and rejects invalid sessions and settings', () => {
    const rest = applyTimerCommand(freshTimer(), { type: 'select', index: 1 }, 0)
    expect(applyTimerCommand(rest, { type: 'reset' }, 0).remainingMilliseconds).toBe(300000)
    expect(() => applyTimerCommand(rest, { type: 'select', index: 999 }, 0)).toThrow()
    expect(() => applyTimerCommand(rest, { type: 'configure', settings: { ...defaultSettings, focusSeconds: -1 } }, 0)).toThrow()
    expect(isSharedTimerState(rest)).toBe(true)
    expect(isSharedTimerState({ ...rest, endsAt: 12 })).toBe(false)
    expect(isSharedTimerState({ ...rest, remainingMilliseconds: Infinity })).toBe(false)
  })
})
