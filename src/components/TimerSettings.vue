<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { validateSettings } from '../domain/settings'
import type { TimerSettings } from '../domain/settings'

const props = defineProps<{ settings: TimerSettings }>()
const emit = defineEmits<{ save: [settings: TimerSettings]; cancel: [] }>()
const draft = reactive({ ...props.settings })
const minutes = reactive({
  focus: Number((props.settings.focusSeconds / 60).toFixed(4)),
  rest: Number((props.settings.restSeconds / 60).toFixed(4)),
  longRest: Number((props.settings.longRestSeconds / 60).toFixed(4)),
})
const error = ref('')
const dialog = ref<HTMLDialogElement>()
onMounted(() => dialog.value?.showModal())
function submit() {
  if (Object.values(minutes).some(value => !Number.isFinite(value) || value <= 0 || value > 120)) {
    error.value = 'Durations must be greater than 0 and no more than 120 minutes.'
    return
  }
  const next = {
    ...draft,
    focusSeconds: Math.round(minutes.focus * 60),
    restSeconds: Math.round(minutes.rest * 60),
    longRestSeconds: Math.round(minutes.longRest * 60),
  }
  error.value = validateSettings(next) ? 'Choose durations of at least one second and no more than 120 minutes, and a whole-number long rest frequency from 0 to 12.' : ''
  if (!error.value) emit('save', next)
}
</script>

<template>
  <dialog ref="dialog" aria-labelledby="settings-title" data-testid="settings-dialog" @cancel.prevent="emit('cancel')">
    <form novalidate @submit.prevent="submit">
      <div class="heading">
        <div><p class="eyebrow">MAKE IT YOURS</p><h2 id="settings-title">Your rhythm</h2></div>
        <button type="button" class="close" aria-label="Close settings" @click="emit('cancel')">×</button>
      </div>
      <p class="description">Choose your own durations. Saving starts a fresh timer and clears this visit’s completed count.</p>
      <label>Focus duration <span>minutes</span><input v-model.number="minutes.focus" data-testid="focus-duration" type="number" min="0.0167" max="120" step="any" /></label>
      <label class="toggle"><input v-model="draft.breaksEnabled" data-testid="enable-breaks" type="checkbox" /> Alternate focus and rest sessions</label>
      <fieldset :disabled="!draft.breaksEnabled">
        <label>Rest duration <span>minutes</span><input v-model.number="minutes.rest" data-testid="rest-duration" type="number" min="0.0167" max="120" step="any" /></label>
        <label>Long rest duration <span>minutes</span><input v-model.number="minutes.longRest" data-testid="long-rest-duration" type="number" min="0.0167" max="120" step="any" /></label>
        <label>Long rest after <span>focus sessions · 0 disables</span><input v-model.number="draft.longRestEvery" data-testid="long-rest-frequency" type="number" min="0" max="12" step="1" /></label>
      </fieldset>
      <label class="toggle"><input v-model="draft.soundEnabled" data-testid="enable-sound" type="checkbox" /> Play a gentle sound on completion</label>
      <p class="hint">Each next session waits for you to press Start.</p>
      <p class="hint">Decimals work too: 0.5 minutes is 30 seconds.</p>
      <p v-if="error" class="error" role="alert" data-testid="settings-error">{{ error }}</p>
      <div class="actions"><button type="button" class="secondary" @click="emit('cancel')">Cancel</button><button type="submit" data-testid="save-settings">Save settings</button></div>
    </form>
  </dialog>
</template>

<style scoped lang="scss">
dialog { width: min(30rem, calc(100% - 2rem)); max-height: calc(100svh - 2rem); padding: 1.75rem; border: 1px solid var(--color-border); border-radius: 1.5rem; background: var(--color-surface); color: var(--color-lime); box-shadow: 0 24px 80px #0007; }
dialog::backdrop { background: #0009; backdrop-filter: blur(5px); }
.heading { display: flex; justify-content: space-between; align-items: start; }
h2 { font-size: 1.75rem; margin: 0; }
.eyebrow { color: var(--color-mint); font-size: .65rem; letter-spacing: .15em; margin: 0 0 .5rem; }
.close { background: transparent; color: var(--color-lime); font-size: 1.75rem; padding: 0 .5rem; }
.description, .hint { color: var(--color-muted); font-size: .85rem; line-height: 1.6; }
label { display: grid; grid-template-columns: 1fr auto; gap: .5rem; margin: 1rem 0; font-size: .85rem; }
label span { color: var(--color-muted); font-size: .75rem; }
input[type='number'] { grid-column: 1 / -1; width: 100%; border: 1px solid var(--color-border); border-radius: .65rem; background: var(--color-background); color: var(--color-lime); padding: .75rem; font: inherit; }
.toggle { display: flex; align-items: center; gap: .75rem; }
input[type='checkbox'] { accent-color: var(--color-mint); width: 1rem; height: 1rem; }
fieldset { border: 0; padding: 0; margin: 0; &:disabled { opacity: .45; } }
.actions { display: flex; justify-content: flex-end; gap: .75rem; margin-top: 1.5rem; }
button { background: var(--color-mint); color: var(--color-background); padding: .75rem 1rem; border-radius: .65rem; font-weight: 600; }
.secondary { background: transparent; color: var(--color-lime); }
.error { color: var(--color-red); font-size: .85rem; }
</style>
