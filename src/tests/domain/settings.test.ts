import { describe, expect, it } from 'vitest'
import { buildConfiguration, defaultSettings, validateSettings, upgradeStarterSettings } from '../../domain/settings'

describe('timer settings', () => {
  it('defaults to four 25-minute focus sessions with short rests and a final long rest', () => {
    const configuration = buildConfiguration(defaultSettings)
    expect(configuration).toEqual([
      { id: 'focus-1', durationSeconds: 1500, countsAsFocus: true },
      { id: 'rest-1', durationSeconds: 300, countsAsFocus: false },
      { id: 'focus-2', durationSeconds: 1500, countsAsFocus: true },
      { id: 'rest-2', durationSeconds: 300, countsAsFocus: false },
      { id: 'focus-3', durationSeconds: 1500, countsAsFocus: true },
      { id: 'rest-3', durationSeconds: 300, countsAsFocus: false },
      { id: 'focus-4', durationSeconds: 1500, countsAsFocus: true },
      { id: 'long-rest', durationSeconds: 900, countsAsFocus: false },
    ])
  })

  it('upgrades the old starter settings while keeping the sound preference', () => {
    expect(upgradeStarterSettings({ focusSeconds: 65, restSeconds: 300, longRestSeconds: 900, longRestEvery: 0, breaksEnabled: false, soundEnabled: true })).toEqual({ ...defaultSettings, soundEnabled: true })
  })

  it('preserves custom settings', () => {
    const custom = { ...defaultSettings, focusSeconds: 1200, longRestEvery: 2 }
    expect(upgradeStarterSettings(custom)).toEqual(custom)
  })
  it('keeps a numeric timer when breaks are disabled', () => {
    expect(buildConfiguration({ ...defaultSettings, focusSeconds: 12, breaksEnabled: false })).toBe(12)
  })

  it('creates the supplied focus/rest sequence without a fixed long-rest rule', () => {
    expect(buildConfiguration({ ...defaultSettings, focusSeconds: 10, restSeconds: 3, longRestEvery: 0, breaksEnabled: true })).toEqual([
      { id: 'focus-1', durationSeconds: 10, countsAsFocus: true },
      { id: 'rest-1', durationSeconds: 3, countsAsFocus: false },
    ])
  })

  it('uses a long rest only at the chosen frequency', () => {
    expect(buildConfiguration({ ...defaultSettings, focusSeconds: 8, restSeconds: 2, longRestSeconds: 5, longRestEvery: 2, breaksEnabled: true })).toEqual([
      { id: 'focus-1', durationSeconds: 8, countsAsFocus: true },
      { id: 'rest-1', durationSeconds: 2, countsAsFocus: false },
      { id: 'focus-2', durationSeconds: 8, countsAsFocus: true },
      { id: 'long-rest', durationSeconds: 5, countsAsFocus: false },
    ])
  })

  it.each([0, -1, 1.5, Number.NaN, 7201])('rejects invalid focus duration %s', focusSeconds => {
    expect(validateSettings({ ...defaultSettings, focusSeconds })).not.toBeNull()
    expect(() => buildConfiguration({ ...defaultSettings, focusSeconds })).toThrow()
  })

  it.each([-1, 1.5, 13])('rejects invalid long-rest frequency %s', longRestEvery => {
    expect(validateSettings({ ...defaultSettings, longRestEvery })).not.toBeNull()
  })
})
