<script setup lang="ts">
defineProps<{
  isRunning: boolean;
}>();
</script>

<template>
  <button v-if="!isRunning" data-testid="start-button" @click="$emit('start')">
    Start
  </button>
  <button v-if="isRunning" data-testid="pause-button" @click="$emit('pause')">
    Pause
  </button>
  <button data-testid="reset-button" @click="$emit('reset')">Reset</button>
</template>
