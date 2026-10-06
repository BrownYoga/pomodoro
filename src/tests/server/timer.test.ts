import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { getUser } from '@netlify/identity'
import { getDatabase } from '@netlify/database'
import handler from '../../../netlify/functions/timer'
import { defaultSettings } from '../../domain/settings'

vi.mock('@netlify/identity', async importOriginal => ({ ...await importOriginal<typeof import('@netlify/identity')>(), getUser: vi.fn() }))
vi.mock('@netlify/database', () => ({ getDatabase: vi.fn() }))

describe('authenticated timer API against PostgreSQL', () => {
  const db = new PGlite()
  function request(command?: unknown, revision = 0, origin = 'https://timer.example') {
    return new Request('https://timer.example/.netlify/functions/timer', command ? {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ command, revision }),
    } : {})
  }
  beforeAll(async () => {
    await db.exec(await readFile(new URL('../../../netlify/database/migrations/20261006180000_shared_timers.sql', import.meta.url), 'utf8'))
  }, 20000)
  beforeEach(async () => {
    await db.exec('TRUNCATE pomodoro_timers')
    vi.mocked(getUser).mockResolvedValue({ id: 'alice' })
    vi.mocked(getDatabase).mockReturnValue({ sql: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '')
      return (await db.query(query, values)).rows
    } } as unknown as ReturnType<typeof getDatabase>)
  })
  afterAll(async () => { await db.close() })

  it('denies unauthenticated access and cross-origin writes before touching storage', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    expect((await handler(request())).status).toBe(401)
    expect((await handler(request({ type: 'start' }, 0, 'https://other.example'))).status).toBe(403)
    expect(getDatabase).not.toHaveBeenCalled()
  })
  it('creates separate rows based on the verified user, ignoring supplied user IDs', async () => {
    const alice = await (await handler(request({ type: 'start', userId: 'bob' }))).json()
    expect(alice.state.status).toBe('running')
    vi.mocked(getUser).mockResolvedValue({ id: 'bob' })
    const bob = await (await handler(request())).json()
    expect(bob.state.status).toBe('ready')
    expect(bob.revision).toBe(0)
    expect((await db.query('SELECT user_id FROM pomodoro_timers')).rows).toHaveLength(2)
  })
  it('rejects stale changes instead of overwriting another device', async () => {
    const first = await handler(request({ type: 'start' }))
    expect(first.status).toBe(200)
    const stale = await handler(request({ type: 'reset' }))
    expect(stale.status).toBe(409)
    expect((await stale.json()).state.status).toBe('running')
  })
  it('lets only one simultaneous command with the same revision win', async () => {
    await handler(request())
    const responses = await Promise.all([handler(request({ type: 'start' })), handler(request({ type: 'select', index: 1 }))])
    expect(responses.map(response => response.status).sort()).toEqual([200, 409])
  })
  it('counts an expired focus once even when both devices refresh together', async () => {
    await handler(request())
    const started = await (await handler(request({ type: 'configure', settings: { ...defaultSettings, focusSeconds: 1 } }))).json()
    const running = await (await handler(request({ type: 'start' }, started.revision))).json()
    await db.query('UPDATE pomodoro_timers SET state = jsonb_set(state, \'{endsAt}\', \'0\') WHERE user_id = $1', ['alice'])
    const responses = await Promise.all([handler(request()), handler(request())])
    for (const response of responses) {
      const data = await response.json()
      expect(data.state.completedFocusSessions).toBe(1)
      expect(data.state.sessionIndex).toBe(1)
      expect(data.revision).toBe(running.revision + 1)
    }
  })
  it('validates incoming commands and returns storage errors without exposing connection details', async () => {
    expect((await handler(request({ type: 'unknown' }))).status).toBe(400)
    expect((await handler(request({ type: 'configure', settings: { ...defaultSettings, focusSeconds: -2 } }))).status).toBe(400)
    vi.mocked(getDatabase).mockImplementation(() => { throw new Error('secret connection string') })
    const response = await handler(request())
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('secret')
  })
})
