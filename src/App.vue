<template>
  <main>
    <TimerDisplay :value="formatTime(65)" />
  </main>
</template>

<script setup lang="ts">
import TimerDisplay from './components/TimerDisplay.vue';
import { formatTime } from './domain/timer';
</script>