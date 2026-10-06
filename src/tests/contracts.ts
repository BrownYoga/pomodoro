import type { Ref } from 'vue'

// Proposed APIs only. These types do not provide any runtime implementation.
// Durations and sequence are supplied by callers, not default Pomodoro rules.
export interface SessionConfig {
  id: string
  durationSeconds: number
  countsAsFocus: boolean
}

export interface SessionState {
  sessionIndex: number
  remainingSeconds: number
  completedFocusSessions: number
}

export interface PomodoroDomain {
  createSessionState: (sessions: readonly SessionConfig[]) => SessionState
  completeSession: (sessions: readonly SessionConfig[], state: SessionState) => SessionState
}

export interface TimerContract {
  remainingSeconds: Ref<number>
  isRunning: Ref<boolean>
  activeSessionId: Ref<string>
  completedFocusSessions: Ref<number>
  start: () => void
  pause: () => void
  reset: () => void
}

// Retain the numeric duration API already used by the first countdown test.
export type CreateTimer = (configuration: number | readonly SessionConfig[]) => TimerContract
