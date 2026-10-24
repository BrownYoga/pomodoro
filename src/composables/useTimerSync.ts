import { computed, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { User } from '@netlify/identity'
import { refreshSession } from '@netlify/identity'
import type { usePomodoro } from './usePomodoro'
import { isSharedTimerState } from '../domain/sharedTimer'
import type { SharedTimerResponse, TimerCommand } from '../domain/sharedTimer'
import type { TimerSettings } from '../domain/settings'

export function useTimerSync(user: Ref<User | null>, timer: ReturnType<typeof usePomodoro>, saveSettings: (settings: TimerSettings) => void) {
  const message = ref('')
  const busy = ref(false)
  const ready = ref(false)
  const sessionExpired = ref(false)
  const disabled = computed(() => !!user.value && (!ready.value || busy.value || sessionExpired.value))
  let revision = -1
  let generation = 0
  let inFlight = false
  let reading = false
  let requestSequence = 0
  let failures = 0
  let refreshTimeout: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined

  function canRefresh() {
    return !!user.value && !sessionExpired.value && document.visibilityState !== 'hidden' && navigator.onLine !== false
  }
  function scheduleRefresh() {
    clearTimeout(refreshTimeout)
    if (!canRefresh()) return
    refreshTimeout = setTimeout(() => { if (canRefresh()) void request() }, Math.min(30000, 5000 * 2 ** failures))
  }
  function refresh() {
    if (canRefresh() && !inFlight) void request()
  }

  async function request(command?: TimerCommand) {
    if (!user.value || (command && (!ready.value || sessionExpired.value))) return false
    if (inFlight) {
      if (!command || !reading) return false
      // User actions take priority over a background read.
      controller?.abort()
    }
    clearTimeout(refreshTimeout)
    const accountGeneration = generation
    const sequence = ++requestSequence
    const isCurrent = () => accountGeneration === generation && sequence === requestSequence
    const wasReady = ready.value
    let startedAt = Date.now()
    const activeController = new AbortController()
    controller = activeController
    inFlight = true
    reading = !command
    busy.value = !!command
    const timeout = setTimeout(() => activeController.abort(), 10000)
    try {
      const send = () => fetch('/.netlify/functions/timer', {
        method: command ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
        signal: activeController.signal,
        ...(command ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command, revision }) } : {}),
      })
      let response = await send()
      if (!isCurrent()) return false
      if (response.status === 401) {
        // A rejected request has not changed the timer, so it is safe to retry once.
        await refreshSession()
        if (!isCurrent() || activeController.signal.aborted) return false
        startedAt = Date.now()
        response = await send()
      }
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
      sessionExpired.value = false
      failures = 0
      message.value = response.status === 409
        ? 'The timer changed on another device. Updated here; try your action again.'
        : command ? 'Timer saved to your account' : wasReady ? 'Timer synced across your devices' : 'Account timer loaded'
      return response.ok
    } catch (error) {
      if (isCurrent()) {
        failures++
        sessionExpired.value = error instanceof Error && error.message === 'session'
        message.value = sessionExpired.value
          ? 'Sync is paused. Sign in again to reconnect your account timer.'
          : command ? 'Could not save your timer. Check your connection and try your action again.'
            : 'Could not refresh your timer. Reconnecting automatically when online.'
      }
      return false
    } finally {
      clearTimeout(timeout)
      if (isCurrent()) { inFlight = false; reading = false; busy.value = false; scheduleRefresh() }
    }
  }

  watch(user, (nextUser, previousUser) => {
    // A fresh login can reconnect the same account; routine token updates need no reload.
    if (nextUser?.id === previousUser?.id && !sessionExpired.value) return
    generation++
    clearTimeout(refreshTimeout)
    controller?.abort()
    inFlight = false
    busy.value = false
    ready.value = false
    sessionExpired.value = false
    revision = -1
    failures = 0
    message.value = user.value ? 'Connecting your timer…' : ''
    if (user.value) void request()
  }, { immediate: true })
  window.addEventListener('focus', refresh)
  window.addEventListener('online', refresh)
  document.addEventListener('visibilitychange', refresh)
  onUnmounted(() => {
    generation++
    clearTimeout(refreshTimeout)
    controller?.abort()
    window.removeEventListener('focus', refresh)
    window.removeEventListener('online', refresh)
    document.removeEventListener('visibilitychange', refresh)
  })
  return { message, busy, disabled, sessionExpired, request }
}
