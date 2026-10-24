<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useLofiPlayer } from '../composables/useLofiPlayer'
import { LOFI_VIDEO_ID } from '../config/lofi'
import { musicSourceUrl, parseMusicLink, shuffleSongs } from '../domain/music'
import type { MusicSource } from '../domain/music'
import { useMusicLibrary } from '../composables/useMusicLibrary'
import type { SavedMusicLink } from '../composables/useMusicLibrary'

const props = defineProps<{ quiet?: boolean; fadeQuiet?: boolean; isRest?: boolean; focusRunning?: boolean; user?: { id: string } | null }>()
const emit = defineEmits<{ signIn: [] }>()
const provider = ref<'lofi' | 'youtube'>('lofi')
const selected = ref<MusicSource>({ videoId: LOFI_VIDEO_ID })
const musicLink = ref('')
const linkError = ref('')
const linkName = ref('')
const library = useMusicLibrary(computed(() => props.user))
const libraryOpen = ref(false)
const libraryDialog = ref<HTMLDialogElement>()
const libraryButton = ref<HTMLButtonElement>()
const search = ref('')
const filter = ref<'all' | 'songs' | 'playlists'>('all')
const filteredEntries = computed(() => library.entries.value.filter(entry => {
  const song = !!parseMusicLink(entry.url)?.videoId
  return entry.name.toLowerCase().includes(search.value.toLowerCase()) && (filter.value === 'all' || (filter.value === 'songs' ? song : !song))
}))
const songCount = computed(() => new Set(library.entries.value.flatMap(entry => {
  const id = parseMusicLink(entry.url)?.videoId
  return id ? [id] : []
})).size)
const shuffleActive = ref(false)
watch(libraryOpen, async open => {
  await nextTick()
  if (open) libraryDialog.value?.showModal()
})
async function saveLink() {
  if (!parseMusicLink(musicLink.value)) {
    linkError.value = 'Paste a valid YouTube Music or YouTube song or playlist link.'
    return
  }
  linkError.value = ''
  await library.save(musicLink.value, linkName.value)
}
async function saveCurrentSong() {
  const url = refreshCurrentSong()
  if (!url) return
  // Never reuse a playlist or previous song's title for a newly playing song.
  musicLink.value = url
  linkName.value = library.entries.value.find(entry => entry.url === url)?.name ?? ''
  await library.save(url, linkName.value)
}
async function shuffleLibrary() {
  if (props.isRest || library.disabled.value) return
  const ids = shuffleSongs(library.entries.value)
  if (!ids.length) return
  resumeAfterBreak.value = false
  stop()
  shuffleActive.value = true
  selected.value = { videoId: ids[0], queue: ids.slice(1) }
  libraryOpen.value = false
  await play()
}
async function closeLibrary() {
  libraryOpen.value = false
  await nextTick()
  libraryButton.value?.focus()
}
async function playSaved(entry: SavedMusicLink) {
  musicLink.value = entry.url
  linkName.value = entry.name
  await playLink()
  libraryOpen.value = false
}
async function removeSaved(entry: SavedMusicLink, index: number) {
  if (!await library.remove(entry.url)) return
  await nextTick()
  const remaining = filteredEntries.value[Math.min(index, filteredEntries.value.length - 1)]
  if (remaining) {
    const buttons = document.querySelectorAll<HTMLButtonElement>(props.isRest ? '#music-library .music-delete' : '#music-library button[data-library-play]')
    buttons[Math.min(index, buttons.length - 1)]?.focus()
  } else document.querySelector<HTMLInputElement>('#library-search')?.focus()
}
const { expanded, host, state, message, volume, currentSong, refreshCurrentSong, next, play, pause, stop, setVolume, setQuiet } = useLofiPlayer(() => selected.value, () => provider.value === 'lofi')
const isYouTube = computed(() => provider.value === 'youtube')
const sourceUrl = computed(() => isYouTube.value ? currentSong.value || musicSourceUrl(selected.value) : `https://www.youtube.com/watch?v=${LOFI_VIDEO_ID}`)
watch(() => props.quiet, value => setQuiet(!!value, props.fadeQuiet ? 1000 : 0), { immediate: true })
const resumeAfterBreak = ref(false)
watch([() => props.isRest, () => props.focusRunning], ([isRest, focusRunning]) => {
  if (isRest) {
    if (expanded.value) {
      resumeAfterBreak.value = ['playing', 'loading', 'blocked'].includes(state.value)
      if (shuffleActive.value) {
        const id = parseMusicLink(refreshCurrentSong())?.videoId
        const queue = [selected.value.videoId, ...(selected.value.queue ?? [])].filter((value): value is string => !!value)
        const index = id ? queue.indexOf(id) : -1
        if (index >= 0) selected.value = { videoId: id, queue: queue.slice(index + 1) }
      }
      stop()
    }
  } else if (focusRunning && resumeAfterBreak.value) {
    resumeAfterBreak.value = false
    void play()
  }
}, { immediate: true })
const playButton = ref<HTMLButtonElement>()
const youtubeButton = ref<HTMLButtonElement>()
const linkInput = ref<HTMLInputElement>()
watch(() => props.user?.id, () => {
  libraryOpen.value = false
  search.value = ''
  filter.value = 'all'
  musicLink.value = ''
  linkName.value = ''
  linkError.value = ''
  resumeAfterBreak.value = false
  shuffleActive.value = false
  if (isYouTube.value) stop()
  selected.value = { videoId: LOFI_VIDEO_ID }
}, { flush: 'sync' })
async function openYouTube() {
  resumeAfterBreak.value = false
  stop()
  shuffleActive.value = false
  libraryOpen.value = false
  provider.value = 'youtube'
  expanded.value = true
  linkError.value = ''
  await nextTick()
  linkInput.value?.focus()
}
async function playLink() {
  const parsed = parseMusicLink(musicLink.value)
  if (!parsed) {
    linkError.value = 'Paste a valid YouTube Music or YouTube song or playlist link.'
    return
  }
  if (props.isRest) return
  resumeAfterBreak.value = false
  stop()
  selected.value = parsed
  shuffleActive.value = false
  linkError.value = ''
  await play()
}
function playLofi() {
  if (isYouTube.value) {
    resumeAfterBreak.value = false
    stop()
    provider.value = 'lofi'
    selected.value = { videoId: LOFI_VIDEO_ID }
    shuffleActive.value = false
  }
  void play()
}
function setHost(element: Element | ComponentPublicInstance | null) {
  host.value = element instanceof HTMLElement ? element : undefined
}
async function close() {
  resumeAfterBreak.value = false
  libraryOpen.value = false
  stop()
  await nextTick()
  if (isYouTube.value) youtubeButton.value?.focus()
  else playButton.value?.focus()
}
</script>

<template>
  <aside class="lofi" aria-label="Optional study music">
    <Transition name="lofi-expand">
      <section v-if="expanded" id="lofi-panel" class="lofi-panel" data-testid="lofi-panel" :aria-label="isYouTube ? 'YouTube Music player' : 'Lofi Girl player'" @keydown.esc.stop="close">
        <div class="lofi-heading">
          <span>{{ isYouTube ? 'YouTube Music' : 'Lofi Girl' }} <span class="lofi-caption">· {{ isYouTube ? 'your focus soundtrack' : 'study radio' }}</span></span>
          <button aria-label="Stop music and close player" data-testid="lofi-stop" @click="close">×</button>
        </div>
        <template v-if="isYouTube">
          <div v-if="library.available.value" class="library-toolbar">
            <button ref="libraryButton" type="button" aria-haspopup="dialog" @click="libraryOpen = true">Your library ({{ library.entries.value.length }})</button>
            <button type="button" :disabled="isRest || library.disabled.value || !songCount" @click="shuffleLibrary">Shuffle library</button>
          </div>
          <p v-else class="lofi-message">Sign in to Pomodoro to save your own music library. <button class="music-signin" @click="emit('signIn')">Sign in</button></p>
          <form class="music-form" @submit.prevent="playLink">
            <label for="music-link">Song or playlist link</label>
            <input id="music-link" ref="linkInput" v-model="musicLink" type="url" required placeholder="https://music.youtube.com/playlist?list=…" :aria-invalid="!!linkError" aria-describedby="music-help music-link-error" />
            <label for="music-link-name">Name <span class="lofi-caption">(optional)</span></label>
            <input id="music-link-name" v-model="linkName" maxlength="80" placeholder="e.g. Deep focus playlist" />
            <div class="music-form-actions">
            <button type="submit" :disabled="isRest">{{ isRest ? 'Available during focus' : 'Play music' }}</button>
            <button v-if="library.available.value" type="button" class="music-save" :disabled="library.disabled.value" @click="saveLink">Save to library</button>
            </div>
          </form>
          <p v-if="linkError" id="music-link-error" class="lofi-message music-error" role="alert">{{ linkError }}</p>
          <p id="music-help" class="lofi-message">Paste a public or unlisted song or playlist link. Plays through YouTube; some tracks may be unavailable here.</p>
          <p class="lofi-message">Account linking isn’t available yet. Open YouTube Music to access your library and copy a link.</p>
          <a href="https://music.youtube.com/" target="_blank" rel="noopener noreferrer">Open YouTube Music ↗</a>
          <p v-if="library.notice.value" class="lofi-message" role="status">{{ library.notice.value }}</p>
          <button v-if="user && library.expired.value" class="music-signin" @click="emit('signIn')">Sign in again</button>
          <button v-else-if="library.available.value && !library.ready.value && !library.busy.value" class="music-signin" @click="library.reload">Retry library</button>
        </template>
        <div v-if="state !== 'inactive'" :ref="setHost" class="lofi-video" />
        <div v-if="state !== 'inactive'" class="lofi-volume">
          <label for="lofi-volume">Volume</label>
          <input id="lofi-volume" type="range" min="0" max="100" :value="volume" @input="setVolume(Number(($event.target as HTMLInputElement).value))" />
        </div>
        <p v-if="quiet" class="lofi-message" role="status">Music quiet for the voice cue.</p>
        <p v-if="message" class="lofi-message" role="status">{{ message }}</p>
        <div v-if="isYouTube && state !== 'inactive'" class="music-playback">
          <button v-if="state === 'playing'" @click="resumeAfterBreak = false; pause()">Pause music</button>
          <button v-else :disabled="isRest || state === 'loading'" @click="play">{{ state === 'loading' ? 'Loading…' : 'Resume music' }}</button>
          <button v-if="shuffleActive" :disabled="isRest || state === 'loading' || state === 'error'" @click="next">Next song</button>
          <button v-if="library.available.value" :disabled="library.disabled.value || !currentSong" @click="saveCurrentSong">Save current song</button>
        </div>
        <p v-if="isYouTube && shuffleActive" class="lofi-message">Playing your saved songs in shuffled order. YouTube controls recommendations after the queue ends.</p>
        <a v-if="state !== 'inactive'" :href="sourceUrl" target="_blank" rel="noopener noreferrer">{{ isYouTube ? 'Open track or playlist' : 'Open on YouTube' }} ↗</a>
      </section>
    </Transition>
    <dialog v-if="libraryOpen && library.available.value" id="music-library" ref="libraryDialog" class="music-library" aria-labelledby="music-library-title" @cancel.prevent="closeLibrary" @close="libraryOpen = false" @keydown.esc.stop>
      <div class="lofi-heading"><h3 id="music-library-title">Your library ({{ library.entries.value.length }})</h3><button aria-label="Close library" @click="closeLibrary">×</button></div>
      <p class="lofi-message">{{ library.localDev.value ? 'Development library · saved in this browser. No sign-in needed.' : 'Private to your Pomodoro account.' }}</p>
      <div class="library-filters">
        <label for="library-search">Search your library</label>
        <input id="library-search" v-model="search" type="search" autofocus placeholder="Find a song or playlist" />
        <label for="library-filter">Show</label>
        <select id="library-filter" v-model="filter"><option value="all">All links</option><option value="songs">Songs</option><option value="playlists">Playlists</option></select>
      </div>
      <button class="library-shuffle" :disabled="isRest || library.disabled.value || !songCount" @click="shuffleLibrary">Shuffle library</button>
      <p class="lofi-message">Shuffles {{ songCount }} saved {{ songCount === 1 ? 'song' : 'songs' }}. Playlist links play separately.</p>
      <p v-if="library.busy.value" class="lofi-message" role="status">Loading library…</p>
      <p v-else-if="!library.entries.value.length" class="lofi-message">Save your favourite songs and playlists for next time.</p>
      <p v-else-if="!filteredEntries.length" class="lofi-message">No matching songs or playlists.</p>
      <ul v-if="filteredEntries.length">
        <li v-for="(entry, index) in filteredEntries" :key="entry.url">
          <button type="button" data-library-play :disabled="isRest || library.disabled.value" :aria-label="`Play ${entry.name}`" @click="playSaved(entry)">
            <span class="saved-name">{{ entry.name }}</span><span class="saved-type">{{ parseMusicLink(entry.url)?.videoId ? 'Song' : 'Playlist' }}</span>
          </button>
          <button type="button" class="music-delete" :disabled="library.disabled.value" :aria-label="`Delete ${entry.name} from library`" @click="removeSaved(entry, index)">Delete</button>
        </li>
      </ul>
      <p v-if="library.notice.value" class="lofi-message" role="status">{{ library.notice.value }}</p>
    </dialog>
    <div class="music-providers" role="group" aria-label="Study music">
    <button v-if="!isYouTube && state === 'playing'" class="lofi-toggle" data-testid="lofi-pause" aria-controls="lofi-panel" aria-expanded="true" @click="resumeAfterBreak = false; pause()">
      <span aria-hidden="true">Ⅱ</span> Pause lo-fi
    </button>
    <button v-else ref="playButton" class="lofi-toggle" data-testid="lofi-play" :disabled="isRest || (!isYouTube && state === 'loading')" aria-controls="lofi-panel" :aria-expanded="expanded && !isYouTube" @click="playLofi">
      <span aria-hidden="true">♫</span> {{ isRest ? (!isYouTube && resumeAfterBreak ? 'Lo-fi resumes with focus' : 'Lo-fi available during focus') : !isYouTube && state === 'loading' ? 'Loading…' : !isYouTube && (state === 'paused' || state === 'blocked') ? 'Resume lo-fi' : 'Play Lo-fi' }}
    </button>
    <button ref="youtubeButton" class="lofi-toggle youtube-toggle" data-testid="youtube-music" aria-controls="lofi-panel" :aria-expanded="expanded && isYouTube" @click="expanded && isYouTube ? close() : openYouTube()"><span class="youtube-icon" aria-hidden="true">▶</span> YouTube Music</button>
    </div>
  </aside>
</template>

<style scoped>
.lofi { position: fixed; left: max(1rem, env(safe-area-inset-left)); bottom: max(1rem, env(safe-area-inset-bottom)); z-index: 10; display: flex; flex-direction: column; align-items: flex-start; gap: .65rem; }
.lofi-toggle, .lofi-panel { background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-muted); border-radius: .9rem; }
.lofi-toggle { padding: .75rem 1rem; font-size: .8rem; display: flex; gap: .6rem; align-items: center; }
.lofi-toggle:hover, .lofi-heading button:hover { color: var(--color-lime); }
.lofi-toggle:disabled { opacity: .6; cursor: wait; }
.music-providers { display: flex; flex-wrap: wrap; gap: .5rem; }
.youtube-icon { color: var(--color-red); }
.youtube-toggle[aria-expanded="true"] { border-color: var(--color-teal); color: var(--color-mint); }
.music-form { display: grid; gap: .6rem; margin: 1rem 0; font-size: .75rem; }
.music-form input { width: 100%; min-width: 0; background: var(--color-background); border: 1px solid var(--color-border); border-radius: .5rem; color: var(--color-lime); padding: .7rem; }
.music-form button, .music-playback button { background: var(--color-mint); color: var(--color-background); border-radius: .5rem; padding: .65rem; }
.music-form button:disabled, .music-playback button:disabled { opacity: .6; cursor: default; }
.music-form-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
.music-form-actions button { flex: 1; }
.music-form .music-save { background: transparent; color: var(--color-mint); border: 1px solid var(--color-border); }
.music-library { width: min(30rem, calc(100vw - 2rem)); max-height: calc(100dvh - 3rem); padding: 1.25rem; background: var(--color-surface); color: var(--color-lime); border: 1px solid var(--color-border); border-radius: 1rem; box-shadow: 0 12px 40px #0005; }
.music-library::backdrop { background: #0009; }
.library-toolbar { display: flex; flex-wrap: wrap; gap: .5rem; margin: .75rem 0; }
.library-toolbar button, .music-signin { color: var(--color-mint); background: transparent; padding: .5rem; border: 1px solid var(--color-border); border-radius: .5rem; font-size: .75rem; }
.library-toolbar button:disabled { opacity: .6; cursor: default; }
.library-filters { display: grid; gap: .5rem; margin: 1rem 0; font-size: .75rem; }
.library-filters input, .library-filters select { min-width: 0; width: 100%; border: 1px solid var(--color-border); background: var(--color-background); color: var(--color-lime); border-radius: .5rem; padding: .65rem; }
.music-library .library-shuffle { background: var(--color-mint); color: var(--color-background); }
.music-library h3 { font-size: .8rem; font-weight: 500; margin: 0; color: var(--color-mint); }
.music-library ul { list-style: none; padding: 0; margin: .75rem 0 0; max-height: 12rem; overflow-y: auto; }
.music-library li { display: flex; gap: .5rem; align-items: center; border-top: 1px solid var(--color-border); padding: .4rem 0; }
.music-library button { background: transparent; color: var(--color-lime); padding: .5rem; border-radius: .4rem; text-align: left; font-size: .75rem; }
.music-library button[data-library-play] { flex: 1; min-width: 0; }
.music-library button:hover { background: var(--color-background); }
.music-library button:disabled { opacity: .6; cursor: default; }
.saved-name { display: block; overflow-wrap: anywhere; }
.saved-type { display: block; font-size: .65rem; color: var(--color-muted); margin-top: .2rem; }
.music-library .music-delete { color: var(--color-red); }
.music-playback { margin: .75rem 0; display: flex; flex-wrap: wrap; gap: .5rem; }
.music-error { color: var(--color-red); }
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
