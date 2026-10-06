import { ref } from 'vue'
import { defaultSettings, validateSettings, upgradeStarterSettings } from '../domain/settings'
import type { TimerSettings } from '../domain/settings'

const storageKey = 'pomodoro-settings-v1'

export function useSettings() {
  let initial = { ...defaultSettings }
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const candidate = { ...defaultSettings, ...parsed } as TimerSettings
        if (!validateSettings(candidate)) initial = upgradeStarterSettings(candidate)
      }
    }
  } catch { /* Storage may be unavailable; the timer still works. */ }

  const settings = ref(initial)
  const storageMessage = ref('')
  function save(next: TimerSettings) {
    const error = validateSettings(next)
    if (error) throw new Error(error)
    settings.value = { ...next }
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      storageMessage.value = ''
    } catch {
      storageMessage.value = 'Settings applied for this visit. Your browser could not save them.'
    }
  }
  return { settings, save, storageMessage }
}
