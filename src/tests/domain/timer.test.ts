import { describe, expect, it } from 'vitest'
import { decrementTime, formatTime, remainingTime, sessionProgress } from '../../domain/timer'

describe('formatTime', () => {
  it.each([
    [65, '01:05'],
    [9, '00:09'],
    [0, '00:00'],
  ])('formats %i seconds as %s', (seconds, expected) => {
    expect(formatTime(seconds)).toBe(expected)
  })
})

describe('decrementTime', () => {
  it('subtracts elapsed seconds from the remaining time', () => {
    expect(decrementTime(10, 1)).toBe(9)
  })

  it('never counts below zero', () => {
    expect(decrementTime(2, 5)).toBe(0)
  })
})

describe('deadline and progress calculations', () => {
  it('preserves partial seconds and rounds display time up', () => {
    expect(remainingTime(10000, 1500)).toEqual({ milliseconds: 8500, seconds: 9 })
  })

  it('clamps elapsed deadlines at zero', () => {
    expect(remainingTime(10000, 15000)).toEqual({ milliseconds: 0, seconds: 0 })
  })

  it.each([[10, 10, 0], [10, 5, 50], [10, 0, 100], [10, -1, 100], [0, 0, 0]])(
    'calculates progress for duration %i and remaining %i', (duration, remaining, expected) => {
      expect(sessionProgress(duration, remaining)).toBe(expected)
    },
  )
})
