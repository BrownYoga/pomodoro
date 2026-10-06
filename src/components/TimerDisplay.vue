<template>
  <div data-testid="timer-display">
    {{ value }}
  </div>
</template>

<script setup lang="ts">
defineProps<{
  value: string
}>()
</script>