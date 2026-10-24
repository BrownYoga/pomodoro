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
        element.replaceWith(this.frame)
        queueMicrotask(() => options.events.onReady({ target: this }))
      }
      playVideo() { this.frame.dataset.playing = 'true'; this.options.events.onStateChange({ data: 1 }) }
      pauseVideo() { this.frame.dataset.playing = 'false'; this.options.events.onStateChange({ data: 2 }) }
      destroy() { this.frame.remove() }
      setVolume(value: number) { this.frame.dataset.volume = String(value) }
      getDuration() { return 1000 }
      seekTo(value: number) { this.frame.dataset.seek = String(value) }
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

test('saves a named library across reloads and persists deletion', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByTestId('youtube-music').click()
  await page.getByLabel('Song or playlist link', { exact: true }).fill('https://music.youtube.com/playlist?list=PLabcdefghijk')
  await page.getByLabel('Name (optional)', { exact: true }).fill('My focus mix')
  await page.getByRole('button', { name: 'Save to library', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Play My focus mix', exact: true })).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.clock.runFor(250)
  await page.screenshot({ path: 'test-results/music-library-mobile.png', fullPage: true })
  await page.reload()
  await page.getByTestId('youtube-music').click()
  await page.getByRole('button', { name: 'Play My focus mix', exact: true }).click()
  await expect(page.locator('iframe')).toHaveAttribute('data-playing', 'true')
  await page.getByRole('button', { name: 'Delete My focus mix from library', exact: true }).click()
  await expect(page.locator('iframe')).toHaveAttribute('data-playing', 'true')
  await page.reload()
  await page.getByTestId('youtube-music').click()
  await expect(page.getByRole('button', { name: 'Play My focus mix', exact: true })).toHaveCount(0)
  await expect(page.getByText('Save your favourite songs and playlists for next time.')).toBeVisible()
})
