import { describe, expect, it } from 'vitest'
import { decrementTime, formatTime } from '../../domain/timer'

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
