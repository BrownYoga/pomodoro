<script setup lang="ts">
defineProps<{ value: string }>()
</script>

<template>
  <div class="timer-display" data-testid="timer-display" role="timer" aria-label="Time remaining">{{ value }}</div>
</template>

<style scoped lang="scss">
.timer-display { color: var(--color-lime); font-size: clamp(3.5rem, 13vw, 6rem); font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.1; }
</style>
