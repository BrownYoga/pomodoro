import { computed, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { refreshSession } from '@netlify/identity'
import { musicSourceUrl, parseMusicLink } from '../domain/music'

export interface SavedMusicLink { name: string; url: string }
export type MusicAccount = { id: string } | null | undefined

export function useMusicLibrary(user: Readonly<Ref<MusicAccount>>) {
  const entries = ref<SavedMusicLink[]>([])
  const notice = ref('')
  const busy = ref(false)
  const ready = ref(false)
  const expired = ref(false)
  const disabled = computed(() => !user.value || busy.value || !ready.value || expired.value)
  let generation = 0
  let controller: AbortController | undefined

  async function request(command?: { type: 'save' | 'remove'; url: string; name?: string }) {
    if (!user.value || busy.value || (command && disabled.value)) return false
    const token = generation
    const current = () => token === generation
    const active = new AbortController()
    controller = active
    busy.value = true
    const timeout = setTimeout(() => active.abort(), 10000)
    try {
      const send = () => fetch('/.netlify/functions/music-library', {
        method: command ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: active.signal,
        ...(command ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) } : {}),
      })
      let response = await send()
      if (!current()) return false
      if (response.status === 401) {
        await refreshSession()
        if (!current() || active.signal.aborted) return false
        response = await send()
      }
      if (!current()) return false
      if (!response.ok) throw new Error(response.status === 401 ? 'session' : 'network')
      const data = await response.json()
      if (!current()) return false
      if (!Array.isArray(data.entries) || !data.entries.every((entry: SavedMusicLink) => entry && typeof entry.name === 'string' && entry.name.length <= 80 && typeof entry.url === 'string' && parseMusicLink(entry.url))) throw new Error('invalid')
      entries.value = data.entries
      ready.value = true
      expired.value = false
      notice.value = command ? command.type === 'save' ? 'Saved to your account library.' : 'Removed from your library.' : ''
      return true
    } catch (error) {
      if (current()) {
        expired.value = error instanceof Error && error.message === 'session'
        if (expired.value) entries.value = []
        notice.value = expired.value ? 'Sign in again to access your library.'
          : command ? 'Could not update your library. Please try again.' : 'Could not load your library. Please retry.'
      }
      return false
    } finally {
      clearTimeout(timeout)
      if (current()) busy.value = false
    }
  }
  async function save(link: string, name: string) {
    const source = parseMusicLink(link)
    if (!source || name.trim().length > 80) return false
    return request({ type: 'save', url: musicSourceUrl(source), name: name.trim() })
  }
  async function remove(url: string) { return request({ type: 'remove', url }) }

  watch(user, (nextUser, previousUser) => {
    if (nextUser?.id === previousUser?.id && !expired.value) return
    generation++
    controller?.abort()
    entries.value = []
    busy.value = false
    ready.value = false
    expired.value = false
    notice.value = ''
    if (user.value) void request()
  }, { immediate: true, flush: 'sync' })
  onUnmounted(() => { generation++; controller?.abort() })
  return { entries, notice, busy, ready, expired, disabled, save, remove, reload: () => request() }
}
