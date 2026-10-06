// @vitest-environment jsdom
import { describe, it } from 'vitest'

// Define the composable API once session configuration/state are decided.
// Use fake timers and mount a host component when testing lifecycle hooks.
describe('usePomodoro (API pending)', () => {
  it.todo('exposes reactive state initialized from session configuration')
  it.todo('starts the clock and delegates elapsed-time calculations to the domain')
  it.todo('pauses the clock and resumes from the remaining time')
  it.todo('resets according to the chosen reset behaviour')
  it.todo('delegates session transitions and completed focus counting to the domain')
  it.todo('cleans up the clock when its component unmounts')
})
