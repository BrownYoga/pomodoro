import { onUnmounted } from 'vue'

export function useCompletionSound() {
  let context: AudioContext | undefined
  async function unlock() {
    try {
      context ??= new AudioContext()
      await context.resume()
    } catch { /* Audio is optional. */ }
  }
  function play() {
    if (!context || context.state !== 'running') return
    for (const [index, frequency] of [660, 880].entries()) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const time = context.currentTime + index * 0.22
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0, time)
      gain.gain.linearRampToValueAtTime(0.12, time + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(time)
      oscillator.stop(time + 0.22)
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    }
  }
  onUnmounted(() => { void context?.close().catch(() => {}) })
  return { unlock, play }
}
