import { onUnmounted } from 'vue'

export function useCompletionSound() {
  let context: AudioContext | undefined
  const active = new Set<OscillatorNode>()
  function stop() {
    for (const oscillator of active) oscillator.stop()
    active.clear()
  }
  async function unlock() {
    try {
      context ??= new AudioContext()
      await context.resume()
    } catch { /* Audio is optional. */ }
  }
  function play() {
    if (!context || context.state !== 'running') return
    stop()
    // Inharmonic partials give the strike a metallic gong timbre. Their combined
    // peak stays below 1, with a longer decay than the previous quiet chime.
    const partials = [
      [180, 0.3, 4.5], [286, 0.2, 3.8], [416, 0.14, 3.2],
      [574, 0.09, 2.6], [812, 0.06, 1.8], [1040, 0.04, 1.2],
    ] as const
    for (const [frequency, amplitude, decay] of partials) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const time = context.currentTime
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0, time)
      gain.gain.linearRampToValueAtTime(amplitude, time + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + decay)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(time)
      oscillator.stop(time + decay + 0.05)
      active.add(oscillator)
      oscillator.onended = () => { active.delete(oscillator); oscillator.disconnect(); gain.disconnect() }
    }
  }
  onUnmounted(() => { stop(); void context?.close().catch(() => {}) })
  return { unlock, play }
}
