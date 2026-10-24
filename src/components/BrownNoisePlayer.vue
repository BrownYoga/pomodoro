<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useBrownNoise } from '../composables/useBrownNoise'

const props = defineProps<{ quiet?: boolean; fadeQuiet?: boolean; isRest?: boolean; focusRunning?: boolean }>()
const emit = defineEmits<{ activate: [] }>()
const { state, volume, message, play, pause, stop, setVolume, setQuiet } = useBrownNoise()
const expanded = ref(false)
const resumeAfterBreak = ref(false)
const toggle = ref<HTMLButtonElement>()
watch(() => props.quiet, value => setQuiet(!!value, props.fadeQuiet ? 1000 : 30), { immediate: true })
watch([() => props.isRest, () => props.focusRunning], ([rest, focus]) => {
  if (rest && expanded.value) {
    resumeAfterBreak.value = state.value === 'playing' || state.value === 'loading'
    stop()
    expanded.value = false
  } else if (!rest && focus && resumeAfterBreak.value) {
    resumeAfterBreak.value = false
    void start()
  }
}, { immediate: true })
async function start() {
  if (props.isRest) return
  emit('activate')
  expanded.value = true
  await play()
}
function pauseNoise() { resumeAfterBreak.value = false; pause() }
function stopNoise() { resumeAfterBreak.value = false; expanded.value = false; stop() }
async function close() { stopNoise(); await nextTick(); toggle.value?.focus() }
defineExpose({ stop: stopNoise })
</script>

<template>
  <section v-if="expanded" id="brown-noise-panel" class="brown-panel" aria-label="Brown noise player" @keydown.esc.stop="close">
    <div class="brown-heading"><span>Brown noise</span><button aria-label="Stop brown noise and close player" @click="close">×</button></div>
    <p>A soft, low rumble for your focus time.</p>
    <div class="brown-volume"><label for="brown-volume">Volume</label><input id="brown-volume" type="range" min="0" max="100" :value="volume" @input="setVolume(Number(($event.target as HTMLInputElement).value))" /><output for="brown-volume">{{ volume }}%</output></div>
    <p v-if="quiet" role="status">Quiet for the voice cue.</p>
    <p v-if="message" role="status">{{ message }}</p>
    <p class="brown-detail">Generated on your device. No account or internet needed.</p>
  </section>
  <button ref="toggle" class="brown-toggle" data-testid="brown-noise" aria-controls="brown-noise-panel" :aria-expanded="expanded" :disabled="isRest || state === 'loading'" @click="state === 'playing' ? pauseNoise() : start()">
    <span aria-hidden="true">≋</span> {{ isRest ? (resumeAfterBreak ? 'Noise resumes with focus' : 'Brown noise · focus only') : state === 'loading' ? 'Starting…' : state === 'playing' ? 'Pause brown noise' : state === 'paused' ? 'Resume brown noise' : 'Brown noise' }}
  </button>
</template>

<style scoped>
.brown-toggle, .brown-panel { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: .9rem; color: var(--color-muted); }
.brown-toggle { padding: .75rem 1rem; font-size: .8rem; display: flex; align-items: center; gap: .6rem; }
.brown-toggle:hover, .brown-heading button:hover { color: var(--color-lime); }
.brown-toggle:disabled { opacity: .6; cursor: default; }
.brown-toggle[aria-expanded="true"] { border-color: var(--color-teal); color: var(--color-mint); }
.brown-panel { position: absolute; bottom: calc(100% + .65rem); left: 0; width: min(22rem, calc(100vw - 2rem)); padding: 1rem; max-height: calc(100dvh - 9rem); overflow-y: auto; box-shadow: 0 12px 40px #0005; font-size: .75rem; line-height: 1.5; }
.brown-heading { display: flex; align-items: center; justify-content: space-between; color: var(--color-mint); font-size: .85rem; }
.brown-heading button { background: transparent; color: var(--color-muted); font-size: 1.3rem; padding: .2rem .5rem; }
.brown-volume { display: flex; align-items: center; gap: .65rem; margin: 1rem 0; }
.brown-volume input { flex: 1; min-width: 0; accent-color: var(--color-teal); }
.brown-volume output { width: 2.5rem; text-align: right; }
.brown-detail { margin-bottom: 0; font-size: .7rem; }
</style>
