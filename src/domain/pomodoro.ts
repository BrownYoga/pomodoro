export interface SessionConfig {
  id: string;
  durationSeconds: number;
  countsAsFocus: boolean;
}

export function createSessionState(sessions: readonly SessionConfig[]) {
  return {
    sessionIndex: 0,
    remainingSeconds: sessions[0]!.durationSeconds,
    completedFocusSessions: 0,
  };
}
