import { describe, expect, it } from 'vitest'
import * as domain from '../../domain/pomodoro'
import type { SessionConfig } from '../../domain/pomodoro'

const sessions: readonly SessionConfig[] = [
  { id: 'work', durationSeconds: 10, countsAsFocus: true },
  { id: 'rest', durationSeconds: 3, countsAsFocus: false },
  { id: 'another-work', durationSeconds: 7, countsAsFocus: true },
  { id: 'extended-rest', durationSeconds: 6, countsAsFocus: false },
]

describe('configured Pomodoro sessions', () => {
  it('initializes from the first supplied session with no completed focus sessions', () => {
    expect(domain.createSessionState(sessions)).toEqual({
      sessionIndex: 0, remainingSeconds: 10, completedFocusSessions: 0,
    })
  })

  it('uses the caller configuration rather than fixed durations', () => {
    const configuration = [{ id: 'custom', durationSeconds: 17, countsAsFocus: true }]
    expect(domain.createSessionState(configuration).remainingSeconds).toBe(17)
  })

  it('moves to the next configured session and loads its duration', () => {
    expect(domain.completeSession(sessions, {
      sessionIndex: 0, remainingSeconds: 0, completedFocusSessions: 0,
    })).toEqual({ sessionIndex: 1, remainingSeconds: 3, completedFocusSessions: 1 })
  })

  it('follows the supplied sequence without counting a completed rest as focus', () => {
    expect(domain.completeSession(sessions, {
      sessionIndex: 1, remainingSeconds: 0, completedFocusSessions: 1,
    })).toEqual({ sessionIndex: 2, remainingSeconds: 7, completedFocusSessions: 1 })
  })

  it('counts each completed session marked as focus', () => {
    expect(domain.completeSession(sessions, {
      sessionIndex: 2, remainingSeconds: 0, completedFocusSessions: 1,
    })).toEqual({ sessionIndex: 3, remainingSeconds: 6, completedFocusSessions: 2 })
  })

  it('wraps from the last configured session to the first', () => {
    expect(domain.completeSession(sessions, {
      sessionIndex: 3, remainingSeconds: 0, completedFocusSessions: 2,
    })).toEqual({ sessionIndex: 0, remainingSeconds: 10, completedFocusSessions: 2 })
  })

  it('returns a new state without mutating the input state or configuration', () => {
    const configuration = Object.freeze(sessions.map(session => Object.freeze({ ...session })))
    const state = Object.freeze({ sessionIndex: 0, remainingSeconds: 0, completedFocusSessions: 0 })
    const result = domain.completeSession(configuration, state)
    expect(result).not.toBe(state)
    expect(state).toEqual({ sessionIndex: 0, remainingSeconds: 0, completedFocusSessions: 0 })
    expect(configuration).toEqual(sessions)
    expect(result).toEqual({ sessionIndex: 1, remainingSeconds: 3, completedFocusSessions: 1 })
  })
})
