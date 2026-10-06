import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { User } from '@netlify/identity'
import type { usePomodoro } from './usePomodoro'
import { isSharedTimerState } from '../domain/sharedTimer'
import type { SharedTimerResponse, TimerCommand } from '../domain/sharedTimer'
import type { TimerSettings } from '../domain/settings'

export function useTimerSync(user: Ref<User | null>, timer: ReturnType<typeof usePomodoro>, saveSettings: (settings: TimerSettings) => void) {
  const message = ref('')
  const busy = ref(false)
  const ready = ref(false)
  const disabled = computed(() => !!user.value && (!ready.value || busy.value))
  let revision = -1
  let generation = 0
  let requestSequence = 0
  let inFlight = false
  let controller: AbortController | undefined
  let interval: ReturnType<typeof setInterval> | undefined

  async function request(command?: TimerCommand) {
    if (!user.value || (command && !ready.value)) return false
    if (inFlight) {
      if (!command || busy.value) return false
      // A control action takes priority over a background read.
      controller?.abort()
    }
    const accountGeneration = generation
    const sequence = ++requestSequence
    const isCurrent = () => accountGeneration === generation && sequence === requestSequence
    const startedAt = Date.now()
    const activeController = new AbortController()
    controller = activeController
    inFlight = true
    busy.value = !!command
    const timeout = setTimeout(() => activeController.abort(), 10000)
    try {
      const response = await fetch('/.netlify/functions/timer', {
        method: command ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
        signal: activeController.signal,
        ...(command ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command, revision }) } : {}),
      })
      if (!isCurrent()) return false
      if (!response.ok && response.status !== 409) throw new Error(response.status === 401 ? 'session' : 'network')
      const data: SharedTimerResponse = await response.json()
      if (!isCurrent()) return false
      if (!isSharedTimerState(data.state) || !Number.isInteger(data.revision) || !Number.isFinite(data.serverNow)) throw new Error('invalid')
      if (data.revision !== revision) {
        saveSettings(data.state.settings)
        // Estimate transit time and use server time so devices with different clocks agree.
        timer.restore(data.state, data.serverNow + (Date.now() - startedAt) / 2)
        revision = data.revision
      }
      ready.value = true
      message.value = response.status === 409 ? 'The timer changed on another device. Updated here; try your action again.' : 'Synced across your devices'
      return response.ok
    } catch (error) {
      if (isCurrent()) {
        message.value = error instanceof Error && error.message === 'session'
          ? 'Your session expired. Sign out and sign in again to sync.'
          : 'Could not sync. Checking again shortly. Changes need a connection.'
      }
      return false
    } finally {
      clearTimeout(timeout)
      if (isCurrent()) { inFlight = false; busy.value = false }
    }
  }

  function poll() { if (document.visibilityState !== 'hidden') void request() }
  watch(() => user.value?.id, () => {
    generation++
    controller?.abort()
    inFlight = false
    busy.value = false
    ready.value = false
    revision = -1
    message.value = user.value ? 'Connecting your timer…' : ''
    clearInterval(interval)
    if (user.value) {
      void request()
      interval = setInterval(poll, 3000)
    }
  }, { immediate: true })
  onMounted(() => {
    document.addEventListener('visibilitychange', poll)
    window.addEventListener('focus', poll)
    window.addEventListener('online', poll)
  })
  onUnmounted(() => {
    generation++
    controller?.abort()
    clearInterval(interval)
    document.removeEventListener('visibilitychange', poll)
    window.removeEventListener('focus', poll)
    window.removeEventListener('online', poll)
  })
  return { message, busy, disabled, request }
}
