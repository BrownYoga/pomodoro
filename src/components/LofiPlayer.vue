<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useLofiPlayer } from '../composables/useLofiPlayer'
import { LOFI_VIDEO_ID } from '../config/lofi'

const props = defineProps<{ quiet?: boolean; fadeQuiet?: boolean }>()
const { expanded, host, state, message, volume, play, pause, stop, setVolume, setQuiet } = useLofiPlayer()
watch(() => props.quiet, value => setQuiet(!!value, props.fadeQuiet ? 1000 : 0), { immediate: true })
const playButton = ref<HTMLButtonElement>()
function setHost(element: Element | ComponentPublicInstance | null) {
  host.value = element instanceof HTMLElement ? element : undefined
}
async function close() {
  stop()
  await nextTick()
  playButton.value?.focus()
}
</script>

<template>
  <aside class="lofi" aria-label="Optional study music">
    <Transition name="lofi-expand">
      <section v-if="expanded" id="lofi-panel" class="lofi-panel" data-testid="lofi-panel" aria-label="Lofi Girl player">
        <div class="lofi-heading">
          <span>Lofi Girl <span class="lofi-caption">· study radio</span></span>
          <button aria-label="Stop music and close player" data-testid="lofi-stop" @click="close">×</button>
        </div>
        <div :ref="setHost" class="lofi-video" />
        <div class="lofi-volume">
          <label for="lofi-volume">Volume</label>
          <input id="lofi-volume" type="range" min="0" max="100" :value="volume" @input="setVolume(Number(($event.target as HTMLInputElement).value))" />
        </div>
        <p v-if="quiet" class="lofi-message" role="status">Music quiet for the voice cue.</p>
        <p v-if="message" class="lofi-message" role="status">{{ message }}</p>
        <a :href="`https://www.youtube.com/watch?v=${LOFI_VIDEO_ID}`" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a>
      </section>
    </Transition>
    <button v-if="state === 'playing'" class="lofi-toggle" data-testid="lofi-pause" aria-controls="lofi-panel" aria-expanded="true" @click="pause">
      <span aria-hidden="true">Ⅱ</span> Pause lo-fi
    </button>
    <button v-else ref="playButton" class="lofi-toggle" data-testid="lofi-play" :disabled="state === 'loading'" aria-controls="lofi-panel" :aria-expanded="expanded" @click="play">
      <span aria-hidden="true">♫</span> {{ state === 'loading' ? 'Loading…' : state === 'paused' || state === 'blocked' ? 'Resume lo-fi' : 'Play Lo-fi' }}
    </button>
  </aside>
</template>

<style scoped>
.lofi { position: fixed; left: max(1rem, env(safe-area-inset-left)); bottom: max(1rem, env(safe-area-inset-bottom)); z-index: 10; display: flex; flex-direction: column; align-items: flex-start; gap: .65rem; }
.lofi-toggle, .lofi-panel { background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-muted); border-radius: .9rem; }
.lofi-toggle { padding: .75rem 1rem; font-size: .8rem; display: flex; gap: .6rem; align-items: center; }
.lofi-toggle:hover, .lofi-heading button:hover { color: var(--color-lime); }
.lofi-toggle:disabled { opacity: .6; cursor: wait; }
.lofi-panel { width: min(22rem, calc(100vw - 2rem)); min-width: 202px; padding: .75rem; box-shadow: 0 12px 40px #0005; max-height: calc(100dvh - 6rem); overflow-y: auto; }
.lofi-heading { display: flex; justify-content: space-between; align-items: center; gap: .5rem; margin-bottom: .6rem; font-size: .8rem; color: var(--color-mint); }
.lofi-caption { color: var(--color-muted); }
.lofi-heading button { color: var(--color-muted); background: transparent; font-size: 1.3rem; padding: .2rem .5rem; }
.lofi-video { width: 100%; min-width: 200px; height: 200px; background: #000; }
.lofi-video :deep(iframe) { width: 100%; height: 100%; min-width: 200px; min-height: 200px; display: block; border: 0; }
.lofi-volume { display: flex; align-items: center; gap: .75rem; margin: .85rem 0; font-size: .7rem; }
.lofi-volume input { min-width: 0; flex: 1; accent-color: var(--color-teal); }
.lofi-message { font-size: .75rem; line-height: 1.5; margin: .5rem 0; }
.lofi-panel a { color: var(--color-muted); font-size: .7rem; }
.lofi-expand-enter-active, .lofi-expand-leave-active { transition: opacity .18s ease, transform .18s ease; }
.lofi-expand-enter-from, .lofi-expand-leave-to { opacity: 0; transform: translateY(.5rem); }
@media (prefers-reduced-motion: reduce) { .lofi-expand-enter-active, .lofi-expand-leave-active { transition: none; } }
</style>
