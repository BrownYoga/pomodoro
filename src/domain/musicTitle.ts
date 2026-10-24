export async function fetchMusicTitle(url: string, signal?: AbortSignal): Promise<string> {
  try {
    const response = await fetch(`/.netlify/functions/music-title?url=${encodeURIComponent(url)}`, {
      signal: signal ?? AbortSignal.timeout(6000),
    })
    if (!response.ok) return ''
    const data = await response.json()
    return typeof data.title === 'string' ? data.title.trim().slice(0, 80) : ''
  } catch { return '' }
}
