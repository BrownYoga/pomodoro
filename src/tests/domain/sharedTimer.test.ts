import { describe, expect, it } from 'vitest'
import { applyTimerCommand, freshTimer, isSharedTimerState, reconcileTimer } from '../../domain/sharedTimer'
import { defaultSettings } from '../../domain/settings'

describe('shared timer rules', () => {
  const shortSettings = { ...defaultSettings, focusSeconds: 2, restSeconds: 1, longRestSeconds: 3, longRestEvery: 2 }
  it('runs a full cycle, stops after long rest, and starts the next cycle on request', () => {
    const running = applyTimerCommand(freshTimer(shortSettings), { type: 'start' }, 0)
    const longRest = reconcileTimer(running, 5000)
    expect(longRest).toMatchObject({ sessionIndex: 3, endsAt: 8000, status: 'running', completedFocusSessions: 2 })
    const finished = reconcileTimer(running, 60000)
    expect(finished).toMatchObject({ sessionIndex: 0, endsAt: null, status: 'finished', remainingMilliseconds: 2000, completedFocusSessions: 2 })
    expect(reconcileTimer(finished, 120000)).toBe(finished)
    expect(applyTimerCommand(finished, { type: 'start' }, 120000)).toMatchObject({ status: 'running', endsAt: 122000 })
  })
  it('skips only breaks, preserves counts and pause state, and ends a skipped long rest', () => {
    const running = applyTimerCommand(freshTimer(shortSettings), { type: 'start' }, 0)
    expect(applyTimerCommand(running, { type: 'skip-break' }, 0)).toBe(running)
    const skipped = applyTimerCommand(running, { type: 'skip-break' }, 2000)
    expect(skipped).toMatchObject({ sessionIndex: 2, status: 'running', endsAt: 4000, completedFocusSessions: 1 })
    const paused = applyTimerCommand(reconcileTimer(running, 2000), { type: 'pause' }, 2000)
    expect(applyTimerCommand(paused, { type: 'skip-break' }, 2000)).toMatchObject({ sessionIndex: 2, status: 'paused', endsAt: null, completedFocusSessions: 1 })
    expect(applyTimerCommand(running, { type: 'skip-break' }, 5000)).toMatchObject({ sessionIndex: 0, status: 'finished', endsAt: null, completedFocusSessions: 2 })
  })
  it('keeps alternating without long rests across a long absence', () => {
    const running = applyTimerCommand(freshTimer({ ...shortSettings, longRestEvery: 0 }), { type: 'start' }, 0)
    expect(reconcileTimer(running, 3000001)).toMatchObject({ sessionIndex: 0, status: 'running', endsAt: 3002000, remainingMilliseconds: 1999, completedFocusSessions: 1000 })
  })
  it.each(['running', 'paused', 'finished'] as const)('preserves a %s timer when only sound changes', status => {
    const state = { ...freshTimer(), status, sessionIndex: 2, completedFocusSessions: 3,
      remainingMilliseconds: status === 'finished' ? 0 : 123456,
      endsAt: status === 'running' ? 200000 : null }
    const settings = { ...state.settings, soundEnabled: true }
    expect(applyTimerCommand(state, { type: 'configure', settings }, 1000)).toEqual({ ...state, settings })
  })
  it('stores a deadline and preserves fractional seconds through pause and resume', () => {
    const started = applyTimerCommand(freshTimer(), { type: 'start' }, 1000)
    expect(started.endsAt).toBe(1501000)
    const paused = applyTimerCommand(started, { type: 'pause' }, 2250)
    expect(paused.remainingMilliseconds).toBe(1498750)
    expect(paused.endsAt).toBeNull()
    const resumed = applyTimerCommand(paused, { type: 'start' }, 10000)
    expect(resumed.endsAt).toBe(1508750)
  })
  it('reconciles elapsed focus and break time without counting twice', () => {
    const running = applyTimerCommand(freshTimer(), { type: 'start' }, 0)
    const completed = reconcileTimer(running, 2000000)
    expect(completed).toMatchObject({ status: 'running', endsAt: 3300000, sessionIndex: 2,
      remainingMilliseconds: 1300000, completedFocusSessions: 1 })
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
