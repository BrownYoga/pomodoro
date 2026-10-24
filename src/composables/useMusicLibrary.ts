import { ref } from 'vue'
import { musicSourceUrl, parseMusicLink } from '../domain/music'

export interface SavedMusicLink { name: string; url: string }
const storageKey = 'pomodoro-music-library-v1'

export function useMusicLibrary() {
  const entries = ref<SavedMusicLink[]>([])
  const notice = ref('')
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(stored)) throw new Error('Invalid library')
    const urls = new Set<string>()
    for (const entry of stored) {
      if (!entry || typeof entry.name !== 'string' || typeof entry.url !== 'string') continue
      const source = parseMusicLink(entry.url)
      if (!source) continue
      const url = musicSourceUrl(source)
      if (urls.has(url)) continue
      urls.add(url)
      entries.value.push({ name: entry.name.trim().slice(0, 80) || 'Saved music', url })
    }
  } catch {
    notice.value = 'Your saved library could not be loaded. You can still save links for this visit.'
  }

  function persist(success: string) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries.value))
      notice.value = success
    } catch {
      notice.value = 'Your library was updated for this visit, but this browser could not save it. Changes may be lost when you reload.'
    }
  }
  function save(link: string, name: string): boolean {
    const source = parseMusicLink(link)
    if (!source) return false
    const url = musicSourceUrl(source)
    const existing = entries.value.find(entry => entry.url === url)
    const title = name.trim().slice(0, 80)
    if (existing) {
      if (title) existing.name = title
      persist(title ? 'Saved link updated.' : 'This link is already in your library.')
    } else {
      entries.value.push({ url, name: title || `${source.videoId ? 'Song' : 'Playlist'} · ${source.videoId ?? source.playlistId}` })
      persist('Link saved to your library.')
    }
    return true
  }
  function remove(url: string) {
    entries.value = entries.value.filter(entry => entry.url !== url)
    persist('Link removed from your library.')
  }
  return { entries, notice, save, remove }
}
