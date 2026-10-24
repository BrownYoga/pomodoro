import { parseMusicLink } from '../../src/domain/music.ts'

export default async (request: Request) => {
  if (request.method !== 'GET') return new Response(null, { status: 405 })
  const source = parseMusicLink(new URL(request.url).searchParams.get('url') ?? '')
  if (!source) return Response.json({ title: '' }, { status: 400 })
  const url = source.videoId ? `https://www.youtube.com/watch?v=${source.videoId}`
    : `https://www.youtube.com/playlist?list=${source.playlistId}`
  try {
    const endpoint = new URL('https://www.youtube.com/oembed')
    endpoint.searchParams.set('url', url)
    endpoint.searchParams.set('format', 'json')
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(5000), redirect: 'error' })
    if (!response.ok) throw new Error('Unavailable metadata')
    const data = await response.json()
    return Response.json({ title: typeof data.title === 'string' ? data.title.trim().slice(0, 80) : '' })
  } catch { return Response.json({ title: '' }) }
}
