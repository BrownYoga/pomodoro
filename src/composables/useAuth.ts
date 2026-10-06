import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import {
  acceptInvite, getSettings, getUser, handleAuthCallback, login, logout,
  onAuthChange, requestPasswordRecovery, signup, updateUser,
} from '@netlify/identity'
import type { Settings, User } from '@netlify/identity'

export type AuthMode = 'login' | 'signup' | 'recovery' | 'password'

export function useAuth() {
  const user = shallowRef<User | null>(null)
  const settings = shallowRef<Settings | null>(null)
  const loading = ref(true)
  const busy = ref(false)
  const error = ref('')
  const notice = ref('')
  const mode = ref<AuthMode>('login')
  const openRequested = ref(false)
  let inviteToken: string | undefined
  let unsubscribe = () => {}

  async function initialize() {
    loading.value = true
    try {
      settings.value = await getSettings()
    } catch {
      settings.value = null
    }
    try {
      const result = await handleAuthCallback()
      user.value = result?.user ?? await getUser()
      if (result?.type === 'recovery' || result?.type === 'invite') {
        inviteToken = result.token
        mode.value = 'password'
        openRequested.value = true
      }
    } catch {
      error.value = 'This sign-in link could not be used. Request a new link and try again.'
      openRequested.value = true
    } finally {
      loading.value = false
    }
  }

  function changeMode(next: AuthMode) {
    mode.value = next
    error.value = ''
    notice.value = ''
  }

  async function submit(email: string, password: string): Promise<boolean> {
    if (busy.value || !settings.value) return false
    busy.value = true
    error.value = ''
    notice.value = ''
    try {
      if (mode.value === 'login') {
        user.value = await login(email, password)
        return true
      }
      if (mode.value === 'signup') {
        if (settings.value.disableSignup) {
          error.value = 'Registration is by invitation. Ask the site owner for an invite.'
          return false
        }
        const created = await signup(email, password)
        if (settings.value.autoconfirm) {
          user.value = created
          return true
        }
        notice.value = 'Check your email and follow the confirmation link before signing in.'
      } else if (mode.value === 'recovery') {
        await requestPasswordRecovery(email)
        notice.value = 'If an account exists for that email, a password reset link will arrive shortly.'
      } else {
        user.value = inviteToken
          ? await acceptInvite(inviteToken, password)
          : await updateUser({ password })
        inviteToken = undefined
        mode.value = 'login'
        return true
      }
    } catch {
      error.value = mode.value === 'login'
        ? 'Could not sign in. Check your email and password, confirm your email, or try again later.'
        : 'Could not complete that request. Please try again or request a new email link.'
    } finally {
      busy.value = false
    }
    return false
  }

  async function signOut() {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      await logout()
      user.value = null
    } catch {
      user.value = await getUser()
      error.value = 'Could not finish signing out. Please check your connection and try again.'
      openRequested.value = true
    } finally {
      busy.value = false
    }
  }

  onMounted(() => {
    unsubscribe = onAuthChange((_event, nextUser) => { user.value = nextUser })
    void initialize()
  })
  onUnmounted(() => unsubscribe())

  return { user, settings, loading, busy, error, notice, mode, openRequested,
    initialize, changeMode, submit, signOut }
}
