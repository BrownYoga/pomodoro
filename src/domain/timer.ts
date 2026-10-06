// Contract only. Keep this module independent of Vue and browser APIs.

/** Format nonnegative whole seconds as MM:SS. */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  const mm = String(minutes).padStart(2, '0')
  const ss = String(remainingSeconds).padStart(2, '0')

  return `${mm}:${ss}`
}

/** Subtract elapsed whole seconds, clamping the result at zero. */
export function decrementTime(remainingSeconds: number, elapsedSeconds: number): number {
  return Math.max(0, remainingSeconds - elapsedSeconds)
}
