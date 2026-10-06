// Placeholder: later connect Vue ref() state and the clock lifecycle to the
// plain TypeScript domain. Own start/pause/reset and clean up on unmount.
// Session configuration and transition rules have not been chosen yet.
import type { Ref } from "vue";
import { ref } from "vue";
import { decrementTime } from "../domain/timer";

// Minimal contract only: the caller supplies the duration. No clock or state yet.
export interface PomodoroTimer {
  remainingSeconds: Ref<number>;
  isRunning: Ref<boolean>;
  start: () => void;
  pause: () => void;
  reset: () => void;
}

export function usePomodoro(durationSeconds: number): PomodoroTimer {
  const remainingSeconds = ref(durationSeconds);
  const isRunning = ref(false);

  let intervalId: ReturnType<typeof setInterval> | undefined;

  function start() {
    if (isRunning.value) return;
    isRunning.value = true;
    intervalId = setInterval(() => {
      remainingSeconds.value = decrementTime(remainingSeconds.value, 1);

      if (remainingSeconds.value === 0) {
        pause();
      }
    }, 1000);
  }

  function pause() {
    clearInterval(intervalId);
    intervalId = undefined;
    isRunning.value = false;
  }

  function reset() {
    pause();
    remainingSeconds.value = durationSeconds;
  }

  return {
    remainingSeconds,
    isRunning,
    start,
    pause,
    reset,
  };
}
