// Placeholder: later connect Vue ref() state and the clock lifecycle to the
// plain TypeScript domain. Own start/pause/reset and clean up on unmount.
// Session configuration and transition rules have not been chosen yet.
import type { Ref } from "vue";
import { ref } from "vue";
import { decrementTime } from "../domain/timer";

// Minimal contract only: the caller supplies the duration. No clock or state yet.
export interface PomodoroTimer {
  remainingSeconds: Ref<number>;
  start: () => void;
}

export function usePomodoro(durationSeconds: number): PomodoroTimer {
  const remainingSeconds = ref(durationSeconds);
  function start() {
    setInterval(() => {
      remainingSeconds.value = decrementTime(remainingSeconds.value, 1);
    }, 1000);
  }
  return {
    remainingSeconds,
    start,
  };
}
