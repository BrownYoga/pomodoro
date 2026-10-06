import { buildConfiguration, defaultSettings, validateSettings } from './settings'
import type { TimerSettings } from './settings'
import { completeSession } from './pomodoro'

export interface SharedTimerState {
  settings: TimerSettings
  sessionIndex: number
  remainingMilliseconds: number
  endsAt: number | null
  status: 'ready' | 'running' | 'paused' | 'finished'
  completedFocusSessions: number
}
export type TimerCommand = { type: 'start' | 'pause' | 'reset' } |
  { type: 'select'; index: number } | { type: 'configure'; settings: TimerSettings }
export interface SharedTimerResponse { state: SharedTimerState; revision: number; serverNow: number }

export function freshTimer(settings: TimerSettings = defaultSettings): SharedTimerState {
  if (validateSettings(settings)) throw new Error('Invalid settings')
  return { settings: { ...settings }, sessionIndex: 0, remainingMilliseconds: settings.focusSeconds * 1000,
    endsAt: null, status: 'ready', completedFocusSessions: 0 }
}
export function currentDuration(state: SharedTimerState): number {
  const configuration = buildConfiguration(state.settings)
  return typeof configuration === 'number' ? configuration : configuration[state.sessionIndex]!.durationSeconds
}

/** Resolve a finished session once, even when no device was open at its deadline. */
export function reconcileTimer(state: SharedTimerState, now: number): SharedTimerState {
  if (state.status !== 'running' || state.endsAt === null || state.endsAt > now) return state
  const configuration = buildConfiguration(state.settings)
  if (typeof configuration === 'number') {
    return { ...state, endsAt: null, remainingMilliseconds: 0, status: 'finished', completedFocusSessions: state.completedFocusSessions + 1 }
  }
  const next = completeSession(configuration, { sessionIndex: state.sessionIndex, remainingSeconds: 0,
    completedFocusSessions: state.completedFocusSessions })
  return { ...state, sessionIndex: next.sessionIndex, remainingMilliseconds: next.remainingSeconds * 1000,
    completedFocusSessions: next.completedFocusSessions, endsAt: null, status: 'ready' }
}

export function applyTimerCommand(input: SharedTimerState, command: TimerCommand, now: number): SharedTimerState {
  const state = reconcileTimer(input, now)
  switch (command.type) {
    case 'start':
      if (state.status === 'running' || state.remainingMilliseconds === 0) return state
      return { ...state, status: 'running', endsAt: now + state.remainingMilliseconds }
    case 'pause':
      return state.status === 'running' ? { ...state, status: 'paused', endsAt: null,
        remainingMilliseconds: Math.max(0, state.endsAt! - now) } : state
    case 'reset':
      return { ...state, status: 'ready', endsAt: null, remainingMilliseconds: currentDuration(state) * 1000 }
    case 'select': {
      const configuration = buildConfiguration(state.settings)
      if (typeof configuration === 'number' || !Number.isInteger(command.index) || !configuration[command.index]) throw new Error('Invalid session')
      return { ...state, sessionIndex: command.index, status: 'ready', endsAt: null,
        remainingMilliseconds: configuration[command.index]!.durationSeconds * 1000 }
    }
    case 'configure':
      if (!command.settings) throw new Error('Invalid settings')
      return freshTimer(command.settings)
    default: throw new Error('Invalid command')
  }
}

export function isSharedTimerState(value: unknown): value is SharedTimerState {
  if (!value || typeof value !== 'object') return false
  const state = value as SharedTimerState
  try {
    if (!state.settings || validateSettings(state.settings)) return false
    const configuration = buildConfiguration(state.settings)
    const count = typeof configuration === 'number' ? 1 : configuration.length
    return Number.isInteger(state.sessionIndex) && state.sessionIndex >= 0 && state.sessionIndex < count &&
      Number.isInteger(state.completedFocusSessions) && state.completedFocusSessions >= 0 &&
      Number.isFinite(state.remainingMilliseconds) && state.remainingMilliseconds >= 0 &&
      state.remainingMilliseconds <= currentDuration(state) * 1000 &&
      ['ready', 'paused', 'running', 'finished'].includes(state.status) &&
      (state.status === 'running' ? Number.isFinite(state.endsAt) && state.endsAt !== null : state.endsAt === null)
  } catch { return false }
}
