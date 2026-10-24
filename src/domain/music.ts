export interface MusicSource {
  videoId?: string
  playlistId?: string
}

/** Accept share links only; never use arbitrary URLs as player or link targets. */
export function parseMusicLink(value: string): MusicSource | undefined {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return
    const youtube = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)
    const short = url.hostname === 'youtu.be'
    if (!youtube && !short) return
    if (short ? !/^\/[\w-]{11}$/.test(url.pathname) : !['/watch', '/playlist'].includes(url.pathname)) return
    const videoId = short ? url.pathname.slice(1) : url.searchParams.get('v') ?? undefined
    const playlistId = url.searchParams.get('list') ?? undefined
    if (videoId !== undefined && !/^[\w-]{11}$/.test(videoId)) return
    if (playlistId !== undefined && !/^[\w-]{10,100}$/.test(playlistId)) return
    if (!videoId && !playlistId) return
    return { videoId, playlistId }
  } catch { return }
}

export function musicSourceUrl(source: MusicSource): string {
  const url = new URL(source.videoId ? 'https://music.youtube.com/watch' : 'https://music.youtube.com/playlist')
  if (source.videoId) url.searchParams.set('v', source.videoId)
  if (source.playlistId) url.searchParams.set('list', source.playlistId)
  return url.href
}
