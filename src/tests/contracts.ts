import type { usePomodoro } from '../composables/usePomodoro'

// Tests use the real production API types, without casts or placeholders.
export type { SessionConfig, SessionState } from '../domain/pomodoro'
export type TimerContract = ReturnType<typeof usePomodoro>
