<script setup lang="ts">
import TimerDisplay from "./components/TimerDisplay.vue";
import TimerControls from "./components/TimerControls.vue";
import { formatTime } from "./domain/timer";
import { usePomodoro } from "./composables/usePomodoro.ts";
import { ref } from "vue";

const hasPaused = ref(false);
const { remainingSeconds, isRunning, start, pause, reset } = usePomodoro(65);

function handleStart() {
  hasPaused.value = false;
  start();
}

function handlePause() {
  pause();
  hasPaused.value = true;
}

function handleReset() {
  reset();
  hasPaused.value = false;
}
</script>

<template>
  <main class="timer-page">
    <p data-testid="timer-status">
      {{
        isRunning
          ? "Running"
          : hasPaused
            ? "Paused"
            : remainingSeconds === 0
              ? "Finished"
              : "Ready"
      }}
    </p>
    <TimerDisplay :value="formatTime(remainingSeconds)" />
    <div class="timer-controls">
      <TimerControls
        :isRunning="isRunning"
        @start="handleStart"
        @pause="handlePause"
        @reset="handleReset"
      />
    </div>
  </main>
</template>
