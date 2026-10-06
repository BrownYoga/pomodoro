<script setup lang="ts">
import TimerDisplay from "./components/TimerDisplay.vue";
import TimerControls from "./components/TimerControls.vue";
import { formatTime } from "./domain/timer";
import { usePomodoro } from "./composables/usePomodoro.ts";

const { remainingSeconds, isRunning, start, pause, reset } = usePomodoro(65);
</script>

<template>
  <main>
    <TimerDisplay :value="formatTime(remainingSeconds)" />
    <TimerControls
      :isRunning="isRunning"
      @start="start"
      @pause="pause"
      @reset="reset"
    />
  </main>
</template>
