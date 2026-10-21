export interface SessionConfig {
  id: string
  durationSeconds: number
  countsAsFocus: boolean
}
export interface SessionState {
  sessionIndex: number
  remainingSeconds: number
  completedFocusSessions: number
}

export function validateSessions(sessions: readonly SessionConfig[]) {
  if (!sessions.length) throw new Error('Configure at least one session.')
  for (const session of sessions) {
    if (!session.id.trim() || !Number.isInteger(session.durationSeconds) || session.durationSeconds < 1 || typeof session.countsAsFocus !== 'boolean') {
      throw new Error('Each session needs an ID, a positive whole-second duration, and a focus flag.')
    }
  }
}

export function createSessionState(sessions: readonly SessionConfig[]): SessionState {
  validateSessions(sessions)
  return { sessionIndex: 0, remainingSeconds: sessions[0]!.durationSeconds, completedFocusSessions: 0 }
}

export function completeSession(sessions: readonly SessionConfig[], state: SessionState): SessionState {
  validateSessions(sessions)
  if (!Number.isInteger(state.sessionIndex) || !sessions[state.sessionIndex]) throw new Error('Invalid session index.')
  const finishedSession = sessions[state.sessionIndex]!
  const nextIndex = (state.sessionIndex + 1) % sessions.length
  return {
    sessionIndex: nextIndex,
    remainingSeconds: sessions[nextIndex]!.durationSeconds,
    completedFocusSessions: state.completedFocusSessions + (finishedSession.countsAsFocus ? 1 : 0),
  }
}

/** Keep deadlines anchored to elapsed time, stopping after the long rest. */
export function advanceSequence(sessions: readonly SessionConfig[], state: SessionState, endsAt: number, now: number) {
  let next = state
  let completed = 0
  let lastCompletedSession = ''
  while (endsAt <= now) {
    lastCompletedSession = sessions[next.sessionIndex]!.id
    next = completeSession(sessions, next)
    completed++
    if (lastCompletedSession === 'long-rest') {
      return { ...next, endsAt: null, completed, lastCompletedSession }
    }
    // Without long rests the sequence repeats indefinitely. Skip whole cycles
    // after wrapping so a long absence does not require one loop per period.
    if (next.sessionIndex === 0 && !sessions.some(session => session.id === 'long-rest')) {
      const cycleMilliseconds = sessions.reduce((sum, session) => sum + session.durationSeconds * 1000, 0)
      const cycles = Math.floor((now - endsAt) / cycleMilliseconds)
      next = { ...next, completedFocusSessions: next.completedFocusSessions + cycles * sessions.filter(session => session.countsAsFocus).length }
      completed += cycles * sessions.length
      endsAt += cycles * cycleMilliseconds
    }
    endsAt += next.remainingSeconds * 1000
  }
  return { ...next, endsAt, completed, lastCompletedSession }
}
