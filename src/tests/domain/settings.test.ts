import { describe, expect, it } from 'vitest'
import { buildConfiguration, defaultSettings, validateSettings } from '../../domain/settings'

describe('timer settings', () => {
  it('keeps a numeric timer when breaks are disabled', () => {
    expect(buildConfiguration({ ...defaultSettings, focusSeconds: 12 })).toBe(12)
  })

  it('creates the supplied focus/rest sequence without a fixed long-rest rule', () => {
    expect(buildConfiguration({ ...defaultSettings, focusSeconds: 10, restSeconds: 3, breaksEnabled: true })).toEqual([
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
