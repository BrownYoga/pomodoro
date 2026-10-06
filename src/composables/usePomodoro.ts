// Placeholder: later connect Vue ref() state and the clock lifecycle to the
// plain TypeScript domain. Own start/pause/reset and clean up on unmount.
// Session configuration and transition rules have not been chosen yet.
import type { Ref } from "vue";
import { ref, onUnmounted } from "vue";
import { decrementTime } from "../domain/timer";
import { createSessionState, completeSession } from "../domain/pomodoro";
import type { SessionConfig } from "../domain/pomodoro";

// Minimal contract only: the caller supplies the duration. No clock or state yet.
export interface PomodoroTimer {
  remainingSeconds: Ref<number>;
  isRunning: Ref<boolean>;
  start: () => void;
  pause: () => void;
  reset: () => void;
  activeSessionId: Ref<string>;
  completedFocusSessions: Ref<number>;
}

export function usePomodoro(
  configuration: number | readonly SessionConfig[],
): PomodoroTimer {
  const initialState =
    typeof configuration === "number"
      ? undefined
      : createSessionState(configuration);
  const durationSeconds =
    typeof configuration === "number"
      ? configuration
      : initialState!.remainingSeconds;
  const remainingSeconds = ref(durationSeconds);
  const isRunning = ref(false);
  const activeSessionId = ref(
    typeof configuration === "number" ? "" : configuration[0]!.id,
  );
  const completedFocusSessions = ref(initialState?.completedFocusSessions ?? 0);

  let sessionIndex = initialState?.sessionIndex ?? 0;
  let intervalId: ReturnType<typeof setInterval> | undefined;

  function start() {
    if (isRunning.value) return;
    isRunning.value = true;
    intervalId = setInterval(() => {
      remainingSeconds.value = decrementTime(remainingSeconds.value, 1);

      if (remainingSeconds.value === 0) {
        pause();

        if (typeof configuration !== "number") {
          const nextState = completeSession(configuration, {
            sessionIndex,
            remainingSeconds: remainingSeconds.value,
            completedFocusSessions: completedFocusSessions.value,
          });

          sessionIndex = nextState.sessionIndex;
          remainingSeconds.value = nextState.remainingSeconds;
          completedFocusSessions.value = nextState.completedFocusSessions;
          activeSessionId.value = configuration[sessionIndex]!.id;
        }
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
    remainingSeconds.value =
      typeof configuration === "number"
        ? configuration
        : configuration[sessionIndex]!.durationSeconds;
  }

  onUnmounted(pause);

  return {
    remainingSeconds,
    isRunning,
    start,
    pause,
    reset,
    activeSessionId,
    completedFocusSessions,
  };
}
