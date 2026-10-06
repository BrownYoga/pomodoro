import { computed, onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'
import { createSessionState, completeSession, validateSessions } from '../domain/pomodoro'
import type { SessionConfig } from '../domain/pomodoro'
import { remainingTime, sessionProgress } from '../domain/timer'

export type TimerStatus = 'ready' | 'running' | 'paused' | 'finished'
export interface PomodoroTimer {
  remainingSeconds: Ref<number>
  isRunning: Ref<boolean>
  status: Ref<TimerStatus>
  activeSessionId: Ref<string>
  completedFocusSessions: Ref<number>
  start: () => void
  pause: () => void
  reset: () => void
}

export function usePomodoro(initialConfiguration: number | readonly SessionConfig[]) {
  const remainingSeconds = ref(0)
  const isRunning = ref(false)
  const status = ref<TimerStatus>('ready')
  const activeSessionId = ref('')
  const completedFocusSessions = ref(0)
  const sessionIndex = ref(0)
  const sessions = ref<SessionConfig[]>([])
  const standaloneDuration = ref(0)
  const completionCount = ref(0)
  const lastCompletedSession = ref('')
  const durationSeconds = computed(() => sessions.value[sessionIndex.value]?.durationSeconds ?? standaloneDuration.value)
  const progress = computed(() => sessionProgress(durationSeconds.value, remainingSeconds.value))
  let intervalId: ReturnType<typeof setInterval> | undefined
  let deadline = 0
  let remainingMilliseconds = 0

  function stopClock() {
    clearInterval(intervalId)
    intervalId = undefined
    isRunning.value = false
  }

  function tick() {
    const remaining = remainingTime(deadline, Date.now())
    remainingMilliseconds = remaining.milliseconds
    remainingSeconds.value = remaining.seconds
    if (remainingMilliseconds > 0) return
    stopClock()
    lastCompletedSession.value = activeSessionId.value || 'focus'
    completionCount.value++
    if (sessions.value.length) {
      const next = completeSession(sessions.value, {
        sessionIndex: sessionIndex.value,
        remainingSeconds: 0,
        completedFocusSessions: completedFocusSessions.value,
      })
      sessionIndex.value = next.sessionIndex
      remainingSeconds.value = next.remainingSeconds
      completedFocusSessions.value = next.completedFocusSessions
      activeSessionId.value = sessions.value[next.sessionIndex]!.id
      remainingMilliseconds = next.remainingSeconds * 1000
      status.value = 'ready'
    } else {
      completedFocusSessions.value++
      status.value = 'finished'
    }
  }

  function start() {
    if (isRunning.value || remainingSeconds.value === 0) return
    isRunning.value = true
    status.value = 'running'
    deadline = Date.now() + remainingMilliseconds
    intervalId = setInterval(tick, 250)
  }

  function pause() {
    if (!isRunning.value) return
    tick()
    if (!isRunning.value) return
    stopClock()
    status.value = 'paused'
  }

  function reset() {
    stopClock()
    remainingSeconds.value = durationSeconds.value
    remainingMilliseconds = remainingSeconds.value * 1000
    status.value = 'ready'
  }

  function configure(configuration: number | readonly SessionConfig[]) {
    if (typeof configuration === 'number') {
      if (!Number.isInteger(configuration) || configuration < 1) throw new Error('Duration must be a positive whole number of seconds.')
    } else validateSessions(configuration)
    stopClock()
    sessions.value = typeof configuration === 'number' ? [] : configuration.map(session => ({ ...session }))
    standaloneDuration.value = typeof configuration === 'number' ? configuration : 0
    sessionIndex.value = 0
    completedFocusSessions.value = 0
    activeSessionId.value = sessions.value[0]?.id ?? ''
    remainingSeconds.value = typeof configuration === 'number' ? configuration : createSessionState(configuration).remainingSeconds
    remainingMilliseconds = remainingSeconds.value * 1000
    lastCompletedSession.value = ''
    status.value = 'ready'
  }

  function selectSession(index: number) {
    if (!Number.isInteger(index) || !sessions.value[index]) return
    stopClock()
    sessionIndex.value = index
    activeSessionId.value = sessions.value[index]!.id
    reset()
  }

  configure(initialConfiguration)
  onUnmounted(stopClock)
  return { remainingSeconds, isRunning, status, activeSessionId, completedFocusSessions,
    start, pause, reset, configure, selectSession, sessionIndex, sessions,
    durationSeconds, progress, completionCount, lastCompletedSession }
}
