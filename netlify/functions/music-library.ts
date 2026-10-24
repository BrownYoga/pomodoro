import { getUser, verifyRequestOrigin } from '@netlify/identity'
import { getDatabase } from '@netlify/database'
import { musicSourceUrl, parseMusicLink } from '../../src/domain/music.ts'

const reply = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store' },
})

export default async (request: Request) => {
  if (!['GET', 'POST'].includes(request.method)) return reply({ error: 'Method not allowed' }, 405)
  if (request.method === 'POST') {
    try { verifyRequestOrigin(request) } catch { return reply({ error: 'Forbidden' }, 403) }
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'JSON required' }, 415)
    if (Number(request.headers.get('content-length')) > 2048) return reply({ error: 'Request too large' }, 413)
  }
  const user = await getUser()
  if (!user?.id) return reply({ error: 'Sign in required' }, 401)
  let command: { type: 'save' | 'remove'; url: string; name: string; fallback: string } | undefined
  if (request.method === 'POST') {
    try {
      const text = await request.text()
      if (text.length > 2048) return reply({ error: 'Request too large' }, 413)
      const body = JSON.parse(text)
      if (!['save', 'remove'].includes(body.type) || typeof body.url !== 'string') throw new Error()
      const source = parseMusicLink(body.url)
      if (!source || (body.name !== undefined && typeof body.name !== 'string')) throw new Error()
      const name = (body.name ?? '').trim()
      if (name.length > 80) throw new Error()
      command = { type: body.type, url: musicSourceUrl(source), name,
        fallback: `${source.videoId ? 'Song' : 'Playlist'} · ${source.videoId ?? source.playlistId}` }
    } catch { return reply({ error: 'Invalid music link' }, 400) }
  }
  try {
    const db = getDatabase()
    if (command?.type === 'save') {
      await db.sql`INSERT INTO pomodoro_music_links (user_id, url, name)
        VALUES (${user.id}, ${command.url}, ${command.name || command.fallback})
        ON CONFLICT (user_id, url) DO UPDATE SET name = CASE WHEN ${command.name} = ''
        THEN pomodoro_music_links.name ELSE EXCLUDED.name END`
    } else if (command?.type === 'remove') {
      await db.sql`DELETE FROM pomodoro_music_links WHERE user_id = ${user.id} AND url = ${command.url}`
    }
    const entries = await db.sql`SELECT name, url FROM pomodoro_music_links WHERE user_id = ${user.id} ORDER BY created_at DESC, url`
    return reply({ entries })
  } catch { return reply({ error: 'Music library is unavailable. Please try again.' }, 503) }
}
