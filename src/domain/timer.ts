// Pure timer utilities, independent of Vue and browser APIs.

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

/** Reconcile a delayed clock callback against its deadline. */
export function remainingTime(deadlineMilliseconds: number, nowMilliseconds: number) {
  const milliseconds = Math.max(0, deadlineMilliseconds - nowMilliseconds)
  return { milliseconds, seconds: Math.ceil(milliseconds / 1000) }
}

export function sessionProgress(durationSeconds: number, remainingSeconds: number): number {
  if (durationSeconds <= 0) return 0
  return Math.min(100, Math.max(0, (1 - remainingSeconds / durationSeconds) * 100))
}
