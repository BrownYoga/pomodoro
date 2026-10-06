<template>
  <div class="timer-display" data-testid="timer-display">
    {{ value }}
  </div>
</template>

<script setup lang="ts">
defineProps<{
  value: string
}>()
</script>

<style scoped>
.timer-display {
  color: var(--color-lime);
  font-size: clamp(4rem, 18vw, 9rem);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  letter-spacing: -0.04em;
}
</style>
