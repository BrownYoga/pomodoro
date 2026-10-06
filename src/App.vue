<script setup lang="ts">
import TimerDisplay from "./components/TimerDisplay.vue";
import TimerControls from "./components/TimerControls.vue";
import { formatTime } from "./domain/timer";
import { ref } from "vue";

const isRunning = ref(false);

function start() {
  isRunning.value = true;
}
function pause() {
  isRunning.value = false;
}
function reset() {
  isRunning.value = false;
}
</script>

<template>
  <main>
    <TimerDisplay :value="formatTime(65)" />
    <TimerControls
      :isRunning="isRunning"
      @start="start"
      @pause="pause"
      @reset="reset"
    />
  </main>
</template>
