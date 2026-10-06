// Placeholder: later connect Vue ref() state and the clock lifecycle to the
// plain TypeScript domain. Own start/pause/reset and clean up on unmount.
// Session configuration and transition rules have not been chosen yet.
import type { Ref } from 'vue'

// Minimal contract only: the caller supplies the duration. No clock or state yet.
export interface PomodoroTimer {
  remainingSeconds: Ref<number>
  start: () => void
}

export function usePomodoro(_durationSeconds: number): PomodoroTimer {
  throw new Error('TODO: implement usePomodoro')
}
