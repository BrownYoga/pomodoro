// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useMusicLibrary } from '../../composables/useMusicLibrary'

const song = 'https://music.youtube.com/watch?v=abcdefghijk'
beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

it('persists named links, updates duplicates across share formats, and persists deletion', () => {
  const library = useMusicLibrary()
  expect(library.save(song, 'Morning focus')).toBe(true)
  library.save('https://youtu.be/abcdefghijk?si=share', 'Evening focus')
  expect(useMusicLibrary().entries.value).toEqual([{ name: 'Evening focus', url: song }])
  library.save(song, '')
  expect(library.entries.value[0]?.name).toBe('Evening focus')
  library.remove(song)
  expect(useMusicLibrary().entries.value).toEqual([])
})

it('validates stored data and keeps only valid, unique links', () => {
  localStorage.setItem('pomodoro-music-library-v1', JSON.stringify([
    null, { name: 'Unsafe', url: 'javascript:alert(1)' },
    { name: 'Song', url: song }, { name: 'Duplicate', url: 'https://youtu.be/abcdefghijk' },
    { name: 3, url: song },
  ]))
  expect(useMusicLibrary().entries.value).toEqual([{ name: 'Song', url: song }])
})

it('handles damaged data and unavailable storage without losing in-memory changes', () => {
  localStorage.setItem('pomodoro-music-library-v1', '{broken')
  const library = useMusicLibrary()
  expect(library.notice.value).toContain('could not be loaded')
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage full') })
  library.save(song, 'Focus')
  expect(library.entries.value).toHaveLength(1)
  expect(library.notice.value).toContain('could not save')
  library.remove(song)
  expect(library.entries.value).toHaveLength(0)
})

it('rejects invalid links and supplies a default name when left blank', () => {
  const library = useMusicLibrary()
  expect(library.save('https://example.com', 'Invalid')).toBe(false)
  expect(library.entries.value).toHaveLength(0)
  library.save(song, ' ')
  expect(library.entries.value[0]?.name).toBe('Song · abcdefghijk')
})
