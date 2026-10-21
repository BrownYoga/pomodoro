import { expect, test } from '@playwright/test'
import type { YouTubePlayerOptions } from '../src/composables/useLofiPlayer'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install({ time: new Date('2026-10-21T12:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-21T12:01:00Z'))
  await page.addInitScript(() => {
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

test('music remains optional and independent through a complete focus session', async ({ page }) => {
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
