import { nextTick, onUnmounted, ref } from 'vue'
import { LOFI_VIDEO_ID } from '../config/lofi'
import { musicSourceUrl, parseMusicLink } from '../domain/music'
import type { MusicSource } from '../domain/music'

export interface YouTubePlayer {
  playVideo(): void
  pauseVideo(): void
  destroy(): void
  setVolume(volume: number): void
  getDuration(): number
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getVideoUrl(): string
  nextVideo(): void
}
export interface YouTubePlayerOptions {
  videoId?: string
  width: string
  height: string
  playerVars: { playsinline: number; origin: string; autoplay: number; controls: number; listType?: 'playlist'; list?: string; playlist?: string }
  events: {
    onReady(event: { target: YouTubePlayer }): void
    onStateChange(event: { data: number }): void
    onError(event: { data: number }): void
    onAutoplayBlocked(): void
  }
}
interface YouTubeAPI {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer
}
declare global {
  interface Window {
    YT?: YouTubeAPI
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YouTubeAPI> | undefined
export function loadYouTubeAPI(): Promise<YouTubeAPI> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]')
    const script = existing ?? document.createElement('script')
    const cleanup = () => {
      clearTimeout(timeout)
      script.removeEventListener('error', fail)
      if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previous
    }
    const fail = () => {
      cleanup()
      script.remove()
      apiPromise = undefined
      reject(new Error('YouTube could not load. Check your connection or content blocker.'))
    }
    const ready = () => {
      try { previous?.() } finally {
        if (window.YT?.Player) { cleanup(); resolve(window.YT) }
        else fail()
      }
    }
    const timeout = window.setTimeout(fail, 15000)
    window.onYouTubeIframeAPIReady = ready
    script.addEventListener('error', fail, { once: true })
    if (!existing) {
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      document.head.append(script)
    }
  })
  return apiPromise
}

export function useLofiPlayer(source: () => MusicSource = () => ({ videoId: LOFI_VIDEO_ID }), liveRadio: () => boolean = () => true) {
  const expanded = ref(false)
  const host = ref<HTMLElement>()
  const state = ref<'inactive' | 'loading' | 'playing' | 'paused' | 'blocked' | 'error'>('inactive')
  const message = ref('')
  const volume = ref(50)
  const quiet = ref(false)
  const currentSong = ref('')
  let musicLevel = 1
  let fadeInterval: ReturnType<typeof setInterval> | undefined
  let player: YouTubePlayer | undefined
  let ready = false
  let generation = 0
  let readyTimeout: number | undefined
  let playbackTimeout: number | undefined

  function refreshCurrentSong() {
    try {
      const current = ready ? parseMusicLink(player?.getVideoUrl() ?? '') : undefined
      currentSong.value = current?.videoId ? musicSourceUrl({ videoId: current.videoId }) : ''
    } catch { currentSong.value = '' }
    return currentSong.value
  }
  function next() {
    if (!ready) return
    try { player?.nextVideo() } catch { fail('Could not skip this song. Try the YouTube controls.') }
  }

  function clearTimeouts() {
    clearTimeout(readyTimeout)
    clearTimeout(playbackTimeout)
  }
  function fail(text: string) {
    clearTimeouts()
    state.value = 'error'
    message.value = text
    ready = false
    // Removing the iframe also stops sound if the API itself has failed.
    try { player?.destroy() } catch { /* Remove the host contents below too. */ }
    player = undefined
    host.value?.replaceChildren()
  }
  function blocked() {
    clearTimeout(playbackTimeout)
    state.value = 'blocked'
    message.value = 'Press play in the YouTube player to allow music in this browser.'
  }
  function playAtLiveEdge() {
    if (!player || !ready) return
    message.value = ''
    state.value = 'loading'
    clearTimeout(playbackTimeout)
    playbackTimeout = window.setTimeout(blocked, 8000)
    try {
      // For live events duration is elapsed broadcast time, not an exact live-edge API.
      // YouTube clamps this best-effort seek to its available playback window.
      if (liveRadio()) {
        const duration = player.getDuration()
        if (Number.isFinite(duration) && duration > 0) player.seekTo(duration, true)
      }
      player.playVideo()
    } catch { fail('YouTube playback failed. Try again or open the stream on YouTube.') }
  }
  async function play() {
    if (ready) { playAtLiveEdge(); return }
    if (state.value === 'loading') return
    const token = ++generation
    expanded.value = true
    state.value = 'loading'
    message.value = 'Loading YouTube…'
    await nextTick()
    try {
      const api = await loadYouTubeAPI()
      if (token !== generation || !host.value) return
      // YouTube replaces its target; keep Vue's host element intact for retries.
      const target = document.createElement('div')
      host.value.replaceChildren(target)
      readyTimeout = window.setTimeout(() => {
        if (token === generation) fail('YouTube took too long to load. Try again or open the stream on YouTube.')
      }, 15000)
      const selected = source()
      player = new api.Player(target, {
        videoId: selected.videoId, width: '100%', height: '100%',
        playerVars: { playsinline: 1, origin: window.location.origin, autoplay: 0, controls: 1,
          ...(selected.queue?.length ? { playlist: selected.queue.join(',') } : {}),
          ...(selected.playlistId ? { listType: 'playlist' as const, list: selected.playlistId } : {}) },
        events: {
          onReady: (event) => {
            if (token !== generation || state.value === 'error') return
            clearTimeout(readyTimeout)
            player = event.target
            ready = true
            refreshCurrentSong()
            try { player.setVolume(volume.value * musicLevel); playAtLiveEdge() }
            catch { fail('YouTube playback failed. Please try again.') }
          },
          onStateChange: ({ data }) => {
            if (token !== generation || state.value === 'error') return
            if (data === 1 || data === 2 || data === 0) {
              refreshCurrentSong()
              clearTimeout(playbackTimeout)
              state.value = data === 1 ? 'playing' : 'paused'
              message.value = data === 0 ? 'Playback ended. You can play again or open YouTube.' : ''
            }
          },
          onAutoplayBlocked: () => { if (token === generation && state.value !== 'error') blocked() },
          onError: () => {
            if (token === generation) fail('This stream cannot be played here. Try again or open it on YouTube.')
          },
        },
      })
    } catch (error) {
      if (token === generation) fail(error instanceof Error ? error.message : 'YouTube could not load. Please try again.')
    }
  }
  function pause() {
    clearTimeout(playbackTimeout)
    try { player?.pauseVideo(); state.value = 'paused'; message.value = '' }
    catch { fail('YouTube playback failed. Please try again.') }
  }
  function setVolume(value: number) {
    volume.value = Math.max(0, Math.min(100, value))
    applyVolume()
  }
  function applyVolume() {
    try { if (ready) player?.setVolume(volume.value * musicLevel) }
    catch { fail('YouTube playback failed. Please try again.') }
  }
  function setQuiet(value: boolean, fadeMilliseconds = 0) {
    clearInterval(fadeInterval)
    quiet.value = value
    if (value && fadeMilliseconds > 0 && ready) {
      const startedAt = Date.now()
      const initialLevel = musicLevel
      fadeInterval = setInterval(() => {
        musicLevel = initialLevel * Math.max(0, 1 - (Date.now() - startedAt) / fadeMilliseconds)
        applyVolume()
        if (musicLevel === 0) clearInterval(fadeInterval)
      }, 50)
      return
    }
    musicLevel = value ? 0 : 1
    applyVolume()
  }
  function stop() {
    clearInterval(fadeInterval)
    musicLevel = quiet.value ? 0 : 1
    ++generation
    clearTimeouts()
    try { player?.destroy() } catch { /* Removing the iframe below stops playback. */ }
    host.value?.replaceChildren()
    player = undefined
    ready = false
    expanded.value = false
    state.value = 'inactive'
    currentSong.value = ''
    message.value = ''
  }
  onUnmounted(stop)
  return { expanded, host, state, message, volume, quiet, currentSong, refreshCurrentSong, next, play, pause, stop, setVolume, setQuiet }
}
