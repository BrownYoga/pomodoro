import { onUnmounted, ref } from 'vue'

/** Integrated white noise, with a short overlap for a continuous loop. */
export function brownNoiseSamples(sampleRate: number, seconds = 12) {
  const samples = new Float32Array(Math.round(sampleRate * seconds))
  let previous = 0
  for (let index = 0; index < samples.length; index++) {
    previous = (previous + .02 * (Math.random() * 2 - 1)) / 1.02
    samples[index] = previous * 3.5
  }
  const overlap = Math.min(Math.round(sampleRate * .05), Math.floor(samples.length / 2))
  for (let index = 0; index < overlap; index++) {
    const mix = index / (overlap - 1)
    const tail = samples.length - overlap + index
    samples[tail] = samples[tail]! * (1 - mix) + samples[index]! * mix
  }
  return { samples, loopStart: overlap / sampleRate }
}

export function useBrownNoise() {
  const state = ref<'inactive' | 'loading' | 'playing' | 'paused' | 'error'>('inactive')
  const volume = ref(30)
  const message = ref('')
  let context: AudioContext | undefined
  let gain: GainNode | undefined
  let source: AudioBufferSourceNode | undefined
  let buffer: AudioBuffer | undefined
  let loopStart = 0
  let quiet = false
  let generation = 0

  function silenceSource() {
    try { source?.stop() } catch { /* Startup may have failed before the source started. */ }
    source?.disconnect()
    source = undefined
  }
  function stop() {
    generation++
    silenceSource()
    gain?.disconnect()
    gain = undefined
    const previous = context
    context = undefined
    buffer = undefined
    void previous?.close().catch(() => {})
    state.value = 'inactive'
    message.value = ''
  }
  function applyVolume(milliseconds = 30) {
    if (!context || !gain) return
    const now = context.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(quiet ? 0 : volume.value / 100, now + milliseconds / 1000)
  }
  async function play() {
    if (state.value === 'playing' || state.value === 'loading') return
    const token = ++generation
    state.value = 'loading'
    message.value = ''
    try {
      context ??= new AudioContext()
      const active = context
      await active.resume()
      if (token !== generation) return
      if (active.state !== 'running') throw new Error('Audio blocked')
      if (!buffer) {
        const noise = brownNoiseSamples(active.sampleRate)
        buffer = active.createBuffer(1, noise.samples.length, active.sampleRate)
        buffer.getChannelData(0).set(noise.samples)
        loopStart = noise.loopStart
      }
      gain ??= active.createGain()
      gain.gain.setValueAtTime(0, active.currentTime)
      gain.connect(active.destination)
      source = active.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.loopStart = loopStart
      source.loopEnd = buffer.duration
      source.connect(gain)
      source.start()
      applyVolume()
      state.value = 'playing'
    } catch {
      if (token !== generation) return
      stop()
      state.value = 'error'
      message.value = 'Brown noise could not start. Check your browser audio settings and try again.'
    }
  }
  function pause() {
    generation++
    silenceSource()
    gain?.disconnect()
    state.value = 'paused'
  }
  function setVolume(value: number) {
    if (!Number.isFinite(value)) return
    volume.value = Math.max(0, Math.min(100, value))
    applyVolume()
  }
  function setQuiet(value: boolean, milliseconds = 30) { quiet = value; applyVolume(milliseconds) }
  onUnmounted(stop)
  return { state, volume, message, play, pause, stop, setVolume, setQuiet }
}
