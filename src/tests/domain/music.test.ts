import { expect, it } from 'vitest'
import { musicSourceUrl, parseMusicLink } from '../../domain/music'

it.each([
  'https://music.youtube.com/watch?v=abcdefghijk&si=share',
  'https://www.youtube.com/watch?v=abcdefghijk',
  'https://youtu.be/abcdefghijk?si=share',
])('accepts song share links: %s', link => {
  expect(parseMusicLink(link)).toEqual({ videoId: 'abcdefghijk', playlistId: undefined })
})

it('preserves a playlist and selected song while stripping unrelated share parameters', () => {
  const source = parseMusicLink('https://music.youtube.com/watch?v=abcdefghijk&list=PLabcdefghijk&si=share')!
  expect(source).toEqual({ videoId: 'abcdefghijk', playlistId: 'PLabcdefghijk' })
  expect(musicSourceUrl(source)).toBe('https://music.youtube.com/watch?v=abcdefghijk&list=PLabcdefghijk')
  expect(parseMusicLink('https://music.youtube.com/playlist?list=PLabcdefghijk')).toEqual({ videoId: undefined, playlistId: 'PLabcdefghijk' })
})

it.each([
  'javascript:alert(1)', 'https://youtube.com.evil.com/watch?v=abcdefghijk',
  'https://evil.com/watch?v=abcdefghijk', 'https://music.youtube.com/',
  'https://music.youtube.com/watch?v=bad', 'http://youtube.com/watch?v=abcdefghijk',
  'https://user:pass@youtube.com/watch?v=abcdefghijk',
  'https://music.youtube.com/playlist?list=bad',
  'https://youtube.com/redirect?v=abcdefghijk',
])('rejects invalid or unrelated links: %s', link => {
  expect(parseMusicLink(link)).toBeUndefined()
})
