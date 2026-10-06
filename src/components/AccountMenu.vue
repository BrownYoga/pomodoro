<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useAuth } from '../composables/useAuth'
import type { AuthMode } from '../composables/useAuth'

const emit = defineEmits<{ 'dialog-change': [open: boolean] }>()
const { user, settings, loading, busy, error, notice, mode, openRequested,
  initialize, changeMode, submit, signOut } = useAuth()
const dialog = ref<HTMLDialogElement>()
const accountButton = ref<HTMLButtonElement>()
const email = ref('')
const password = ref('')
const title = computed(() => ({ login: 'Welcome back', signup: 'Create your account',
  recovery: 'Reset your password', password: 'Choose a new password' })[mode.value])

async function open() {
  emit('dialog-change', true)
  await nextTick()
  dialog.value?.showModal()
}
function close() { dialog.value?.close() }
function onClose() {
  password.value = ''
  emit('dialog-change', false)
  accountButton.value?.focus()
}
function selectMode(next: AuthMode) {
  password.value = ''
  changeMode(next)
}
async function onSubmit() {
  const success = await submit(email.value.trim(), password.value)
  password.value = ''
  if (success) close()
}
watch(openRequested, (requested) => {
  if (requested) { void open(); openRequested.value = false }
})
</script>

<template>
  <div class="account-menu">
    <template v-if="user">
      <span class="account-email" data-testid="account-email" :title="user.email">{{ user.email || user.name || 'Signed in' }}</span>
      <button data-testid="sign-out" :disabled="busy" @click="signOut">Sign out</button>
    </template>
    <button v-else ref="accountButton" data-testid="open-account" @click="open">Sign in</button>
  </div>
  <dialog ref="dialog" aria-labelledby="account-title" data-testid="account-dialog" @cancel="close" @close="onClose">
    <div class="dialog-heading">
      <h2 id="account-title">{{ title }}</h2>
      <button aria-label="Close account dialog" data-testid="close-account" @click="close">×</button>
    </div>
    <p class="muted">Keep using the timer as a guest, or create an account. Timer syncing will be added next.</p>
    <p v-if="loading" role="status">Connecting…</p>
    <div v-else-if="!settings" data-testid="auth-unavailable">
      <p>Sign-in is unavailable right now. You can still use the timer.</p>
      <button @click="initialize">Try again</button>
    </div>
    <template v-else>
      <p v-if="mode === 'signup' && settings.disableSignup">Registration is by invitation. Ask the site owner for an invite.</p>
      <form v-else @submit.prevent="onSubmit">
        <label v-if="mode !== 'password'">Email
          <input v-model="email" type="email" autocomplete="email" required data-testid="auth-email" :disabled="busy" />
        </label>
        <label v-if="mode !== 'recovery'">{{ mode === 'password' ? 'New password' : 'Password' }}
          <input v-model="password" type="password" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            :minlength="mode === 'login' ? undefined : 8" required data-testid="auth-password" :disabled="busy" />
        </label>
        <p v-if="mode === 'signup' || mode === 'password'" class="muted">Use at least 8 characters.</p>
        <button class="submit" type="submit" data-testid="auth-submit" :disabled="busy">
          {{ busy ? 'Please wait…' : ({ login: 'Sign in', signup: 'Create account', recovery: 'Send reset link', password: 'Save password' })[mode] }}
        </button>
      </form>
      <nav v-if="mode !== 'password'" class="auth-links" aria-label="Account options">
        <button v-if="mode !== 'login'" :disabled="busy" @click="selectMode('login')">Back to sign in</button>
        <button v-if="mode === 'login' && !settings.disableSignup" data-testid="create-account" :disabled="busy" @click="selectMode('signup')">Create account</button>
        <button v-if="mode === 'login'" data-testid="forgot-password" :disabled="busy" @click="selectMode('recovery')">Forgot password?</button>
      </nav>
    </template>
    <p v-if="error" class="error" role="alert" data-testid="auth-error">{{ error }}</p>
    <p v-if="notice" class="notice" role="status" data-testid="auth-notice">{{ notice }}</p>
  </dialog>
</template>

<style scoped lang="scss">
button { background: var(--color-surface); color: var(--color-lime); border: 1px solid var(--color-border); border-radius: .7rem; padding: .65rem 1rem; }
.account-menu { display: flex; align-items: center; gap: .75rem; min-width: 0; }
.account-email { max-width: 12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-mint); font-size: .8rem; }
dialog { width: min(28rem, calc(100vw - 2rem)); max-height: calc(100svh - 2rem); overflow-y: auto; padding: 1.5rem; border: 1px solid var(--color-border); border-radius: 1.25rem; background: var(--color-surface); color: var(--color-lime);
  &::backdrop { background: rgb(0 0 0 / 70%); }
}
.dialog-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; h2 { font-size: 1.35rem; margin: 0; } button { font-size: 1.3rem; padding: .2rem .7rem; } }
.muted { color: var(--color-muted); font-size: .85rem; line-height: 1.6; }
form { display: grid; gap: 1rem; label { display: grid; gap: .5rem; font-size: .85rem; } input { min-width: 0; width: 100%; padding: .8rem; border: 1px solid var(--color-border); border-radius: .6rem; background: var(--color-background); color: var(--color-lime); } }
.submit { background: var(--color-mint); color: var(--color-background); }
.auth-links { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: 1rem; button { font-size: .8rem; } }
.error { color: var(--color-red); line-height: 1.5; }
.notice { color: var(--color-mint); line-height: 1.5; }
button:disabled { opacity: .6; cursor: wait; }
@media (max-width: 480px) { .account-email { max-width: 8rem; } }
</style>
