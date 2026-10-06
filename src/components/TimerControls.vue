<script setup lang="ts">
defineProps<{ isRunning: boolean; finished?: boolean; paused?: boolean }>()
defineEmits<{ start: []; pause: []; reset: [] }>()
</script>

<template>
  <div class="controls">
    <button v-if="!isRunning" class="primary" data-testid="start-button" :disabled="finished" @click="$emit('start')">{{ paused ? 'Resume' : 'Start' }} <span aria-hidden="true">▶</span></button>
    <button v-else class="primary running" data-testid="pause-button" @click="$emit('pause')">Pause <span aria-hidden="true">Ⅱ</span></button>
    <button class="reset" data-testid="reset-button" @click="$emit('reset')">Reset <span aria-hidden="true">↺</span></button>
  </div>
</template>

<style scoped lang="scss">
.controls { display: flex; justify-content: center; gap: .75rem; flex-wrap: wrap; }
button { min-height: 3.25rem; min-width: 8.5rem; padding: .8rem 1.4rem; border-radius: .85rem; font-weight: 600; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; transition: background .15s, transform .15s; &:hover:not(:disabled) { transform: translateY(-2px); } }
.primary { background: var(--color-mint); color: var(--color-background); }
.running { background: var(--color-teal); }
.reset { background: #ef858515; color: var(--color-red); border: 1px solid #ef858535; }
button:disabled { opacity: .4; cursor: default; }
</style>
