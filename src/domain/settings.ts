import type { SessionConfig } from './pomodoro'

export interface TimerSettings {
  focusSeconds: number
  restSeconds: number
  longRestSeconds: number
  longRestEvery: number
  breaksEnabled: boolean
  soundEnabled: boolean
}

// Standard Pomodoro defaults; every setting remains editable.
export const defaultSettings: TimerSettings = {
  focusSeconds: 1500,
  restSeconds: 300,
  longRestSeconds: 900,
  longRestEvery: 4,
  breaksEnabled: true,
  soundEnabled: false,
}

/** Upgrade only the exact old starter configuration, preserving sound preference. */
export function upgradeStarterSettings(settings: TimerSettings): TimerSettings {
  const isStarter = settings.focusSeconds === 65 && settings.restSeconds === 300 &&
    settings.longRestSeconds === 900 && settings.longRestEvery === 0 && !settings.breaksEnabled
  return isStarter ? { ...defaultSettings, soundEnabled: settings.soundEnabled } : settings
}

export function validateSettings(settings: TimerSettings): string | null {
  for (const key of ['focusSeconds', 'restSeconds', 'longRestSeconds'] as const) {
    if (!Number.isInteger(settings[key]) || settings[key] < 1 || settings[key] > 7200) {
      return 'Durations must be whole seconds between 1 and 7,200.'
    }
  }
  if (!Number.isInteger(settings.longRestEvery) || settings.longRestEvery < 0 || settings.longRestEvery > 12) {
    return 'Long rest frequency must be a whole number from 0 to 12. Use 0 to turn it off.'
  }
  if (typeof settings.breaksEnabled !== 'boolean' || typeof settings.soundEnabled !== 'boolean') {
    return 'Invalid settings.'
  }
  return null
}

export function buildConfiguration(settings: TimerSettings): number | SessionConfig[] {
  const error = validateSettings(settings)
  if (error) throw new Error(error)
  if (!settings.breaksEnabled) return settings.focusSeconds
  const sequence: SessionConfig[] = []
  const count = settings.longRestEvery || 1
  for (let index = 1; index <= count; index++) {
    sequence.push({ id: `focus-${index}`, durationSeconds: settings.focusSeconds, countsAsFocus: true })
    const longRest = settings.longRestEvery > 0 && index === count
    sequence.push({
      id: longRest ? 'long-rest' : `rest-${index}`,
      durationSeconds: longRest ? settings.longRestSeconds : settings.restSeconds,
      countsAsFocus: false,
    })
  }
  return sequence
}
