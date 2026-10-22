import { onUnmounted, ref } from 'vue'
import breakAudio from "../assets/Sounds/It's time to take a break.mp3"
import studyAudio from "../assets/Sounds/It's time to start studying again.mp3"
import completedAudio from '../assets/Sounds/Your session has been completed.mp3'
import type { SessionConfig } from '../domain/pomodoro'

export type CompletionCue = 'break' | 'study' | 'completed'
const recordings = { break: breakAudio, study: studyAudio, completed: completedAudio }

export function completionCue(sessions: readonly SessionConfig[], index: number): CompletionCue {
  if (!sessions.length) return 'completed'
  if (!sessions[index]?.countsAsFocus) return 'study'
  return sessions[(index + 1) % sessions.length]?.id === 'long-rest' ? 'completed' : 'break'
}

export function useCompletionSound() {
  const playing = ref(false)
  let context: AudioContext | undefined
  let source: AudioBufferSourceNode | undefined
  let generation = 0
  const buffers = new Map<CompletionCue, Promise<AudioBuffer>>()
  function load(cue: CompletionCue) {
    if (!buffers.has(cue)) {
      const audioContext = context!
      const buffer = fetch(recordings[cue], { signal: AbortSignal.timeout(10000) }).then(response => {
        if (!response.ok) throw new Error('Could not load audio')
        return response.arrayBuffer()
      }).then(data => audioContext.decodeAudioData(data)).catch(error => {
        buffers.delete(cue)
        throw error
      })
      buffers.set(cue, buffer)
    }
    return buffers.get(cue)!
  }
  async function unlock() {
    try {
      context ??= new AudioContext()
      await context.resume()
      await Promise.allSettled((Object.keys(recordings) as CompletionCue[]).map(load))
    } catch { /* Audio is optional. */ }
  }
  function stop() {
    generation++
    if (source) {
      source.onended = null
      source.stop()
      source.disconnect()
      source = undefined
    }
    playing.value = false
  }
  async function play(cue: CompletionCue = 'break') {
    stop()
    if (!context || context.state !== 'running') return
    const token = generation
    playing.value = true
    try {
      const buffer = await load(cue)
      if (token !== generation) return
      source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      source.onended = () => {
        if (token !== generation) return
        source?.disconnect()
        source = undefined
        playing.value = false
      }
      source.start()
    } catch {
      if (token === generation) playing.value = false
    }
  }
  onUnmounted(() => { stop(); void context?.close().catch(() => {}) })
  return { unlock, play, stop, playing }
}
