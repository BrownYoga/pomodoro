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
