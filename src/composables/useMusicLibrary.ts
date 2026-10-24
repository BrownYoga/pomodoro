import { computed, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { refreshSession } from '@netlify/identity'
import { musicLibraryUrl, parseMusicLink } from '../domain/music'

export interface SavedMusicLink { name: string; url: string }
export type MusicAccount = { id: string } | null | undefined
const devStorageKey = 'pomodoro-dev-music-library-v1'

export function useMusicLibrary(user: Readonly<Ref<MusicAccount>>) {
  const entries = ref<SavedMusicLink[]>([])
  const notice = ref('')
  const busy = ref(false)
  const ready = ref(false)
  const expired = ref(false)
  const localDev = computed(() => import.meta.env.DEV && !user.value)
  const available = computed(() => !!user.value || localDev.value)
  const disabled = computed(() => !available.value || busy.value || !ready.value || expired.value)
  let generation = 0
  let initialized = false
  let controller: AbortController | undefined

  function loadLocal() {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(devStorageKey) ?? '[]')
      if (!Array.isArray(stored)) throw new Error('Invalid library')
      const unique = new Map<string, SavedMusicLink>()
      for (const entry of stored) {
        if (!entry || typeof entry.name !== 'string' || typeof entry.url !== 'string') continue
        const source = parseMusicLink(entry.url)
        if (!source) continue
        const url = musicLibraryUrl(source)
        unique.set(url, { url, name: entry.name.trim().slice(0, 80) || 'Saved music' })
      }
      entries.value = [...unique.values()]
      notice.value = ''
    } catch { notice.value = 'Could not load the local development library. You can still test it for this visit.' }
    ready.value = true
  }

  async function request(command?: { type: 'save' | 'remove'; url: string; name?: string }) {
    if (!available.value || busy.value || (command && disabled.value)) return false
    if (localDev.value) {
      if (!command) { loadLocal(); return true }
      const existing = entries.value.find(entry => entry.url === command.url)
      if (command.type === 'remove') entries.value = entries.value.filter(entry => entry.url !== command.url)
      else if (existing) { if (command.name) existing.name = command.name }
      else {
        const source = parseMusicLink(command.url)!
        entries.value.push({ url: command.url, name: command.name || `${source.videoId ? 'Song' : 'Playlist'} · ${source.videoId ?? source.playlistId}` })
      }
      try {
        localStorage.setItem(devStorageKey, JSON.stringify(entries.value))
        notice.value = command.type === 'save' ? 'Saved to your local development library.' : 'Removed from your library.'
      } catch { notice.value = 'Development library updated for this visit. Browser storage is unavailable, so changes may be lost on reload.' }
      return true
    }
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
    return request({ type: 'save', url: musicLibraryUrl(source), name: name.trim() })
  }
  async function remove(url: string) { return request({ type: 'remove', url }) }

  watch(user, (nextUser, previousUser) => {
    if (initialized && nextUser?.id === previousUser?.id && !expired.value) return
    initialized = true
    generation++
    controller?.abort()
    entries.value = []
    busy.value = false
    ready.value = false
    expired.value = false
    notice.value = ''
    if (available.value) void request()
  }, { immediate: true, flush: 'sync' })
  onUnmounted(() => { generation++; controller?.abort() })
  return { entries, notice, busy, ready, expired, disabled, localDev, available, save, remove, reload: () => request() }
}
