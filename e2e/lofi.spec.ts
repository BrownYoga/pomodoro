import { expect, test } from '@playwright/test'
import type { YouTubePlayerOptions } from '../src/composables/useLofiPlayer'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install({ time: new Date('2026-10-21T12:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-21T12:01:00Z'))
  await page.addInitScript(() => {
    Object.defineProperty(window, 'NativeAudioContext', { value: window.AudioContext })
    // Keep recording playback deterministic under Playwright's simulated clock.
    class TestAudioContext {
      state = 'running'
      destination = {}
      async resume() {}
      async close() {}
      async decodeAudioData() {
        const root = document.documentElement
        root.dataset.decodedAudio = String(Number(root.dataset.decodedAudio ?? 0) + 1)
        return { duration: 3 }
      }
      createBufferSource() {
        let timeout: ReturnType<typeof setTimeout>
        const source = {
          buffer: null, onended: null as (() => void) | null,
          connect() {}, disconnect() {},
          start() {
            const root = document.documentElement
            root.dataset.cueCount = String(Number(root.dataset.cueCount ?? 0) + 1)
            timeout = setTimeout(() => source.onended?.(), 3000)
          },
          stop() { clearTimeout(timeout) },
        }
        return source
      }
    }
    Object.defineProperty(window, 'AudioContext', { value: TestAudioContext })
    window.YT = { Player: class {
      frame: HTMLIFrameElement
      options: YouTubePlayerOptions
      constructor(element: HTMLElement, options: YouTubePlayerOptions) {
        this.options = options
        this.frame = document.createElement('iframe')
        this.frame.title = 'Lofi Girl study radio'
        this.frame.dataset.video = options.videoId ?? 'abcdefghijk'
        this.frame.dataset.queue = options.playerVars.playlist ?? ''
        this.frame.addEventListener('test-ended', () => this.nextVideo())
        element.replaceWith(this.frame)
        queueMicrotask(() => options.events.onReady({ target: this }))
      }
      playVideo() { this.frame.dataset.playing = 'true'; this.options.events.onStateChange({ data: 1 }) }
      pauseVideo() { this.frame.dataset.playing = 'false'; this.options.events.onStateChange({ data: 2 }) }
      destroy() { this.frame.remove() }
      setVolume(value: number) { this.frame.dataset.volume = String(value) }
      getDuration() { return 1000 }
      seekTo(value: number) { this.frame.dataset.seek = String(value) }
      getVideoUrl() { return `https://www.youtube.com/watch?v=${this.frame.dataset.video}` }
      nextVideo() {
        const queue = this.frame.dataset.queue?.split(',').filter(Boolean) ?? []
        const id = queue.shift()
        if (id) {
          this.frame.dataset.video = id
          this.frame.dataset.queue = queue.join(',')
          this.options.events.onStateChange({ data: 1 })
        }
      }
    } }
  })
  await page.goto('/')
})

test('music stays optional, closes for breaks and reopens for focus', async ({ page }) => {
  const frame = page.locator('iframe[title="Lofi Girl study radio"]')
  await expect(page.getByTestId('lofi-panel')).toHaveCount(0)
  await page.getByTestId('start-button').click()
  await page.getByTestId('pause-button').click()
  await page.getByTestId('reset-button').click()
  await expect(frame).toHaveCount(0)
  await page.getByTestId('lofi-play').click()
  await page.clock.runFor(250)
  await expect(frame).toHaveAttribute('data-playing', 'true')
  await page.getByTestId('start-button').click()
  await page.getByTestId('pause-button').click()
  await page.getByTestId('reset-button').click()
  await expect(frame).toHaveAttribute('data-playing', 'true')
  await page.getByTestId('start-button').click()
  await page.clock.fastForward(25 * 60 * 1000)
  await expect(page.getByTestId('completed-count')).toHaveText('1')
  await expect(frame).toHaveCount(0)
  await page.clock.runFor(250)
  await expect(page.getByTestId('lofi-panel')).toHaveCount(0)
  await expect(page.getByTestId('lofi-play')).toBeDisabled()
  await page.clock.fastForward(5 * 60 * 1000)
  await expect(frame).toHaveAttribute('data-playing', 'true')
  await page.getByTestId('lofi-pause').click()
  await expect(frame).toHaveAttribute('data-playing', 'false')
  await page.getByTestId('lofi-play').click()
  await expect(frame).toHaveAttribute('data-seek', '1000')
  await expect(frame).toHaveAttribute('data-playing', 'true')
  await page.getByTestId('lofi-stop').click()
  await page.clock.runFor(250)
  await expect(frame).toHaveCount(0)
  await expect(page.getByTestId('lofi-panel')).toHaveCount(0)
  await expect(page.getByTestId('lofi-play')).toBeFocused()
})

test('all supplied MP3 recordings decode in the browser', async ({ page }) => {
  const durations = await page.evaluate(async () => {
    const NativeAudio = (window as unknown as { NativeAudioContext: typeof AudioContext }).NativeAudioContext
    const context = new NativeAudio()
    try {
      return await Promise.all([
        "It's time to take a break.mp3",
        "It's time to start studying again.mp3",
        'Your session has been completed.mp3',
      ].map(async name => {
        const response = await fetch(`/src/assets/Sounds/${encodeURIComponent(name)}`)
        if (!response.ok) throw new Error(`Could not load ${name}`)
        const buffer = await context.decodeAudioData(await response.arrayBuffer())
        return buffer.duration
      }))
    } finally { await context.close() }
  })
  expect(durations).toHaveLength(3)
  for (const duration of durations) expect(duration).toBeGreaterThan(0)
})

test('fades music for the cue, closes during long rest and reopens with the next focus', async ({ page }) => {
  await page.getByTestId('open-settings').click()
  await page.getByTestId('focus-duration').fill('0.2')
  await page.getByTestId('long-rest-duration').fill('0.2')
  await page.getByTestId('long-rest-frequency').fill('1')
  await page.getByTestId('enable-sound').check()
  await page.getByTestId('save-settings').click()
  await page.getByTestId('lofi-play').click()
  const frame = page.locator('iframe[title="Lofi Girl study radio"]')
  const root = page.locator('html')
  // Wait for the three real assets to download into the mocked audio decoder.
  await expect(root).toHaveAttribute('data-decoded-audio', '3')
  await expect(frame).toHaveAttribute('data-volume', '50')
  await page.getByTestId('start-button').click()
  await page.clock.runFor(9000)
  await expect(frame).toHaveAttribute('data-volume', '50')
  await page.clock.runFor(500)
  expect(Number(await frame.getAttribute('data-volume'))).toBeGreaterThan(0)
  expect(Number(await frame.getAttribute('data-volume'))).toBeLessThan(50)
  await expect(root).not.toHaveAttribute('data-cue-count')
  await page.clock.runFor(500)
  await expect(frame).toHaveAttribute('data-volume', '0')
  await expect(root).toHaveAttribute('data-cue-count', '1')
  await page.clock.runFor(2000)
  await expect(page.getByTestId('session-label')).toHaveText('Long rest session')
  await expect(root).toHaveAttribute('data-cue-count', '1')
  await expect(frame).toHaveCount(0)
  await page.clock.runFor(1000)
  await expect(frame).toHaveCount(0)
  await page.clock.runFor(9000)
  await expect(root).toHaveAttribute('data-cue-count', '2')
  await expect(frame).toHaveCount(0)
  await page.clock.runFor(2000)
  await expect(page.getByTestId('timer-status')).toHaveText('Finished')
  await expect(root).toHaveAttribute('data-cue-count', '2')
  await page.clock.runFor(1000)
  await expect(frame).toHaveCount(0)
  await page.getByTestId('start-button').click()
  await expect(frame).toHaveAttribute('data-volume', '50')
  await expect(frame).toHaveAttribute('data-playing', 'true')
  await page.getByTestId('open-settings').click()
  await page.getByTestId('test-sound').click()
  await expect(frame).toHaveAttribute('data-volume', '0')
  await page.clock.runFor(3000)
  await expect(frame).toHaveAttribute('data-volume', '50')
})

test('keeps the mobile player visible at YouTube minimum dimensions', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByTestId('lofi-play').click()
  const frame = page.locator('iframe[title="Lofi Girl study radio"]')
  await expect(frame).toBeVisible()
  await page.clock.runFor(250)
  await expect(page.getByTestId('lofi-panel')).toHaveCSS('opacity', '1')
  const bounds = await frame.boundingBox()
  expect(bounds!.width).toBeGreaterThanOrEqual(200)
  expect(bounds!.height).toBeGreaterThanOrEqual(200)
  await expect(frame).toBeInViewport()
  // Hit-test the actual iframe, including its edges, to catch app controls
  // covering the video or YouTube's own controls.
  expect(await frame.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return [1, bounds.width / 2, bounds.width - 1].every(x =>
      [1, bounds.height / 2, bounds.height - 1].every(y =>
        document.elementFromPoint(bounds.left + x, bounds.top + y) === element,
      ),
    )
  })).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/lofi-mobile.png', fullPage: true })
})

test('opens YouTube Music on mobile, plays a link and restores focus when closed', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByTestId('youtube-music').click()
  await expect(page.getByLabel('Song or playlist link', { exact: true })).toBeFocused()
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.getByLabel('Song or playlist link', { exact: true }).fill('https://music.youtube.com/watch?v=abcdefghijk')
  await page.getByRole('button', { name: 'Play music', exact: true }).click()
  const frame = page.locator('iframe')
  await expect(frame).toHaveAttribute('data-playing', 'true')
  await expect(frame).not.toHaveAttribute('data-seek')
  await page.clock.runFor(250)
  await expect(frame).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/youtube-music-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Pause music', exact: true }).click()
  await expect(frame).toHaveAttribute('data-playing', 'false')
  await page.getByRole('button', { name: 'Resume music', exact: true }).click()
  await expect(frame).not.toHaveAttribute('data-seek')
  await page.getByTestId('lofi-stop').click()
  await expect(page.getByTestId('youtube-music')).toBeFocused()
  await expect(frame).toHaveCount(0)
})

test('keeps the account library compact, shuffles songs and clears private state on sign-out', async ({ page }) => {
  const account = { id: 'music-user', email: 'music@example.com', user_metadata: { full_name: 'Music Tester' }, app_metadata: { provider: 'email' } }
  const jwt = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: account.id, exp: 4_000_000_000 })).toString('base64url')}.test-signature`
  let entries: { name: string; url: string }[] = []
  await page.route('**/.netlify/identity/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/').at(-1)
    const json = path === 'settings' ? { autoconfirm: false, external: { email: true } }
      : path === 'token' ? { access_token: jwt, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600 }
        : path === 'user' ? account : {}
    await route.fulfill({ json })
  })
  await page.route('**/.netlify/functions/music-library', async route => {
    if (route.request().method() === 'POST') {
      const command = route.request().postDataJSON()
      entries = entries.filter(entry => entry.url !== command.url)
      if (command.type === 'save') entries.push({ name: command.name || 'Saved song', url: command.url })
    }
    await route.fulfill({ json: { entries } })
  })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByTestId('youtube-music').click()
  await expect(page.getByRole('button', { name: 'Save to library', exact: true })).toBeEnabled()
  await page.getByTestId('open-account').click()
  await page.getByTestId('auth-email').fill('music@example.com')
  await page.getByTestId('auth-password').fill('test-password')
  await page.getByTestId('auth-submit').click()
  await expect(page.getByTestId('account-dialog')).not.toBeVisible()
  await page.getByTestId('youtube-music').click()
  await page.getByLabel('Song or playlist link', { exact: true }).fill('https://music.youtube.com/playlist?list=PLabcdefghijk')
  await page.getByLabel('Name (optional)', { exact: true }).fill('My focus mix')
  await page.getByRole('button', { name: 'Save to library', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Your library (1)', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Your library' })).toHaveCount(0)
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.getByRole('button', { name: 'Your library (1)', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Play My focus mix', exact: true })).toBeVisible()
  await page.clock.runFor(250)
  await page.screenshot({ path: 'test-results/music-library-mobile.png', fullPage: true })
  await page.reload()
  await expect(page.getByTestId('account-email')).toHaveText('Music Tester')
  await page.getByTestId('youtube-music').click()
  await page.getByRole('button', { name: 'Your library (1)', exact: true }).click()
  await page.getByRole('button', { name: 'Play My focus mix', exact: true }).click()
  await expect(page.locator('iframe')).toHaveAttribute('data-playing', 'true')
  await page.getByRole('button', { name: 'Your library (1)', exact: true }).click()
  await page.getByRole('button', { name: 'Delete My focus mix from library', exact: true }).click()
  await expect(page.locator('iframe')).toHaveAttribute('data-playing', 'true')
  await expect(page.getByRole('button', { name: 'Play My focus mix', exact: true })).toHaveCount(0)
  await expect(page.getByText('Save your favourite songs and playlists for next time.')).toBeVisible()
  await page.getByRole('button', { name: 'Close library', exact: true }).click()
  for (const [id, name] of [['abcdefghijk', 'First song'], ['lmnopqrstuv', 'Second song']]) {
    await page.getByLabel('Song or playlist link', { exact: true }).fill(`https://music.youtube.com/watch?v=${id}`)
    await page.getByLabel('Name (optional)', { exact: true }).fill(name!)
    await page.getByRole('button', { name: 'Save to library', exact: true }).click()
    await expect(page.getByText('Saved to your account library.', { exact: true })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Shuffle library', exact: true }).click()
  const frame = page.locator('iframe')
  await expect(frame).toHaveAttribute('data-playing', 'true')
  const first = await frame.getAttribute('data-video')
  await page.getByRole('button', { name: 'Next song', exact: true }).click()
  await expect(frame).not.toHaveAttribute('data-video', first!)
  await page.getByRole('button', { name: 'Your library (2)', exact: true }).click()
  await page.getByLabel('Search your library', { exact: true }).fill('Second')
  await expect(page.getByRole('button', { name: 'Play First song', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Play Second song', exact: true })).toBeVisible()
  await page.getByLabel('Search your library', { exact: true }).fill('')
  await page.screenshot({ path: 'test-results/music-library-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Close library', exact: true }).click()
  await page.getByTestId('sign-out').click()
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.getByTestId('youtube-music').click()
  await expect(page.getByRole('button', { name: 'Your library (0)', exact: true })).toBeVisible()
  await expect(page.getByLabel('Song or playlist link', { exact: true })).toHaveValue('')
})

test('tests the local development library without signing in', async ({ page }) => {
  let libraryRequests = 0
  page.on('request', request => { if (request.url().includes('/.netlify/functions/music-library')) libraryRequests++ })
  await page.getByTestId('youtube-music').click()
  await page.getByLabel('Song or playlist link', { exact: true }).fill('https://music.youtube.com/watch?v=abcdefghijk')
  await page.getByLabel('Name (optional)', { exact: true }).fill('Dev focus')
  await page.getByRole('button', { name: 'Save to library', exact: true }).click()
  await page.reload()
  await page.getByTestId('youtube-music').click()
  await page.getByRole('button', { name: 'Your library (1)', exact: true }).click()
  await expect(page.getByText('Development library · saved in this browser. No sign-in needed.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play Dev focus', exact: true })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Shuffle library', exact: true }).click()
  await expect(page.locator('iframe')).toHaveAttribute('data-video', 'abcdefghijk')
  await page.getByRole('button', { name: 'Your library (1)', exact: true }).click()
  await page.getByRole('button', { name: 'Delete Dev focus from library', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Play Dev focus', exact: true })).toHaveCount(0)
  expect(libraryRequests).toBe(0)
})
