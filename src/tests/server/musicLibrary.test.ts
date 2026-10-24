import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { getUser } from '@netlify/identity'
import { getDatabase } from '@netlify/database'
import handler from '../../../netlify/functions/music-library'

vi.mock('@netlify/identity', async original => ({ ...await original<typeof import('@netlify/identity')>(), getUser: vi.fn() }))
vi.mock('@netlify/database', () => ({ getDatabase: vi.fn() }))
const db = new PGlite()
const song = 'https://music.youtube.com/watch?v=abcdefghijk'
const request = (body?: unknown, origin = 'https://timer.example') => new Request('https://timer.example/.netlify/functions/music-library', body ? {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
} : {})
beforeAll(async () => {
  await db.exec(await readFile(new URL('../../../netlify/database/migrations/20261024120000_music_library.sql', import.meta.url), 'utf8'))
}, 20000)
beforeEach(async () => {
  await db.exec('TRUNCATE pomodoro_music_links')
  vi.mocked(getUser).mockResolvedValue({ id: 'alice' })
  vi.mocked(getDatabase).mockReset().mockReturnValue({ sql: async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '')
    return (await db.query(query, values)).rows
  } } as unknown as ReturnType<typeof getDatabase>)
})
afterAll(async () => { await db.close() })

it('denies guests, cross-origin writes, non-JSON and oversized bodies', async () => {
  vi.mocked(getUser).mockResolvedValue(null)
  expect((await handler(request())).status).toBe(401)
  expect((await handler(request({ type: 'save', url: song }, 'https://other.example'))).status).toBe(403)
  expect(getDatabase).not.toHaveBeenCalled()
  vi.mocked(getUser).mockResolvedValue({ id: 'alice' })
  expect((await handler(new Request('https://timer.example', { method: 'POST', headers: { Origin: 'https://timer.example' }, body: '{}' }))).status).toBe(415)
  expect((await handler(request({ type: 'save', url: song, name: 'a'.repeat(2048) }))).status).toBe(413)
})

it('isolates reads, writes and deletes by verified identity, ignoring supplied user IDs', async () => {
  await handler(request({ type: 'save', url: song, name: 'Alice private', userId: 'bob' }))
  vi.mocked(getUser).mockResolvedValue({ id: 'bob' })
  expect(await (await handler(request())).json()).toEqual({ entries: [] })
  await handler(request({ type: 'remove', url: song, userId: 'alice' }))
  await handler(request({ type: 'save', url: song, name: 'Bob private' }))
  vi.mocked(getUser).mockResolvedValue({ id: 'alice' })
  const response = await handler(request())
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await response.json()).toEqual({ entries: [{ name: 'Alice private', url: song }] })
})

it('canonicalizes duplicate links and preserves names on blank updates', async () => {
  await handler(request({ type: 'save', url: song, name: 'Focus' }))
  await handler(request({ type: 'save', url: 'https://youtu.be/abcdefghijk?si=share' }))
  await handler(request({ type: 'save', url: `${song}&list=PLabcdefghijk` }))
  await handler(request({ type: 'save', url: `${song}&list=PLlmnopqrstuv` }))
  expect(await (await handler(request())).json()).toEqual({ entries: [{ name: 'Focus', url: song }] })
  await handler(request({ type: 'save', url: song, name: 'New name' }))
  expect(await (await handler(request())).json()).toEqual({ entries: [{ name: 'New name', url: song }] })
  await handler(request({ type: 'remove', url: song }))
  expect(await (await handler(request())).json()).toEqual({ entries: [] })
})

it('merges existing playlist variants in the migration without mixing accounts', async () => {
  await db.query('INSERT INTO pomodoro_music_links (user_id, url, name, created_at) VALUES ($1, $2, $3, $4), ($1, $5, $6, $7)',
    ['alice', song, 'Old', '2026-10-01', `${song}&list=PLabcdefghijk`, 'Newest', '2026-10-02'])
  await db.query('INSERT INTO pomodoro_music_links (user_id, url, name) VALUES ($1, $2, $3)', ['bob', song, 'Bob'])
  await db.exec(await readFile(new URL('../../../netlify/database/migrations/20261025090000_unique_music_songs.sql', import.meta.url), 'utf8'))
  expect((await db.query('SELECT user_id, url, name FROM pomodoro_music_links ORDER BY user_id')).rows).toEqual([
    { user_id: 'alice', url: song, name: 'Newest' }, { user_id: 'bob', url: song, name: 'Bob' },
  ])
})

it('rejects unsafe links, malformed commands and long names', async () => {
  for (const body of [ { type: 'save', url: 'javascript:alert(1)' }, { type: 'unknown', url: song }, { type: 'save', url: song, name: 'a'.repeat(81) }, { type: 'save', url: song, name: 123 } ]) {
    expect((await handler(request(body))).status).toBe(400)
  }
  expect((await handler(new Request('https://timer.example', { method: 'DELETE' }))).status).toBe(405)
  expect(getDatabase).not.toHaveBeenCalled()
})

it('keeps simultaneous saves without overwriting the whole library and hides database errors', async () => {
  await Promise.all([
    handler(request({ type: 'save', url: song, name: 'One' })),
    handler(request({ type: 'save', url: 'https://music.youtube.com/watch?v=lmnopqrstuv', name: 'Two' })),
  ])
  expect((await (await handler(request())).json()).entries).toHaveLength(2)
  vi.mocked(getDatabase).mockImplementation(() => { throw new Error('secret connection') })
  const response = await handler(request())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain('secret')
})
