export interface SessionConfig {
  id: string;
  durationSeconds: number;
  countsAsFocus: boolean;
}

export interface SessionState {
  sessionIndex: number;
  remainingSeconds: number;
  completedFocusSessions: number;
}

export function createSessionState(sessions: readonly SessionConfig[]) {
  return {
    sessionIndex: 0,
    remainingSeconds: sessions[0]!.durationSeconds,
    completedFocusSessions: 0,
  };
}

export function completeSession(
  sessions: readonly SessionConfig[],
  state: SessionState,
): SessionState {
  const finishedSession = sessions[state.sessionIndex]!;
  const nextIndex = (state.sessionIndex + 1) % sessions.length;

  return {
    sessionIndex: nextIndex,
    remainingSeconds: sessions[nextIndex]!.durationSeconds,
    completedFocusSessions:
      state.completedFocusSessions + (finishedSession.countsAsFocus ? 1 : 0),
  };
}
