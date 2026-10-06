import { getUser, verifyRequestOrigin } from '@netlify/identity'
import { getDatabase } from '@netlify/database'
import { applyTimerCommand, freshTimer, reconcileTimer } from '../../src/domain/sharedTimer.ts'
import type { SharedTimerState, TimerCommand } from '../../src/domain/sharedTimer.ts'

interface Row extends Record<string, unknown> { state: SharedTimerState; revision: number }
const headers = { 'Cache-Control': 'private, no-store' }
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers })

export default async (request: Request) => {
  if (!['GET', 'POST'].includes(request.method)) return reply({ error: 'Method not allowed' }, 405)
  if (request.method === 'POST') {
    try { verifyRequestOrigin(request) } catch { return reply({ error: 'Forbidden' }, 403) }
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'JSON required' }, 415)
    if (Number(request.headers.get('content-length')) > 4096) return reply({ error: 'Request too large' }, 413)
  }
  const user = await getUser()
  if (!user?.id) return reply({ error: 'Sign in required' }, 401)
  let command: TimerCommand | undefined
  let expectedRevision: number | undefined
  if (request.method === 'POST') {
    try {
      const text = await request.text()
      if (text.length > 4096) return reply({ error: 'Request too large' }, 413)
      const body = JSON.parse(text)
      if (!body.command || !Number.isInteger(body.revision) || body.revision < 0) throw new Error()
      command = body.command
      expectedRevision = body.revision
    } catch { return reply({ error: 'Invalid request' }, 400) }
  }
  try {
    const db = getDatabase()
    await db.sql`INSERT INTO pomodoro_timers (user_id, state) VALUES (${user.id}, ${JSON.stringify(freshTimer())}::jsonb) ON CONFLICT (user_id) DO NOTHING`
    for (let attempt = 0; attempt < 5; attempt++) {
      const rows = await db.sql<Row>`SELECT state, revision FROM pomodoro_timers WHERE user_id = ${user.id}`
      const row = rows[0]!
      const now = Date.now()
      if (command && expectedRevision !== row.revision) return reply({ state: row.state, revision: row.revision, serverNow: now }, 409)
      let state: SharedTimerState
      try { state = command ? applyTimerCommand(row.state, command, now) : reconcileTimer(row.state, now) }
      catch { return reply({ error: 'Invalid timer command' }, 400) }
      if (state === row.state) return reply({ state, revision: row.revision, serverNow: now })
      // A conditional update prevents two devices from completing or overwriting a session twice.
      const updated = await db.sql<Row>`UPDATE pomodoro_timers SET state = ${JSON.stringify(state)}::jsonb,
        revision = revision + 1, updated_at = NOW() WHERE user_id = ${user.id} AND revision = ${row.revision} RETURNING state, revision`
      if (updated[0]) return reply({ ...updated[0], serverNow: now })
    }
    return reply({ error: 'Timer changed on another device. Try again.' }, 409)
  } catch {
    return reply({ error: 'Timer storage is unavailable. Please try again shortly.' }, 503)
  }
}
