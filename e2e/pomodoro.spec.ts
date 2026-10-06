import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Freeze browser time before loading the app; advance it explicitly in tests.
  const now = new Date('2026-01-01T00:00:00Z')
  await page.clock.install({ time: now })
  await page.clock.pauseAt(now)
  await page.goto('/')
})

test('shows the timer display and idle controls', async ({ page }) => {
  await expect(page.getByTestId('timer-display')).toBeVisible()
  await expect(page.getByTestId('start-button')).toBeEnabled()
  await expect(page.getByTestId('reset-button')).toBeEnabled()
  await page.screenshot({ path: 'test-results/timer-desktop.png', fullPage: true })
})

test('lets the user start and pause using the controls', async ({ page }) => {
  await page.getByTestId('start-button').click()
  await expect(page.getByTestId('pause-button')).toBeEnabled()
  await page.getByTestId('pause-button').click()
  await expect(page.getByTestId('start-button')).toBeEnabled()
})

test('shows Ready, Running, Paused, and Ready after reset', async ({ page }) => {
  const status = page.getByTestId('timer-status')
  const display = page.getByTestId('timer-display')

  await expect(status).toHaveText('Ready')
  const initialTime = await display.innerText()

  await page.getByTestId('start-button').click()
  await expect(status).toHaveText('Running')

  // Pause before the first tick: the status must reflect the action,
  // even though the remaining time is still the initial duration.
  await page.getByTestId('pause-button').click()
  await expect(status).toHaveText('Paused')
  await expect(display).toHaveText(initialTime)
  await page.clock.runFor(2000)
  await expect(status).toHaveText('Paused')
  await expect(display).toHaveText(initialTime)

  await page.getByTestId('reset-button').click()
  await expect(status).toHaveText('Ready')
  await expect(display).toHaveText(initialTime)
})

test('counts down, pauses, resumes, and resets the displayed time', async ({ page }) => {
  const display = page.getByTestId('timer-display')

  // The current App.vue supplies a 65-second example, not a Pomodoro default.
  await expect(display).toHaveText('01:05')
  await page.getByTestId('start-button').click()
  await page.clock.runFor(1000)
  await expect(display).toHaveText('01:04')

  await page.getByTestId('pause-button').click()
  await page.clock.runFor(3000)
  await expect(display).toHaveText('01:04')

  await page.getByTestId('start-button').click()
  await page.clock.runFor(1000)
  await expect(display).toHaveText('01:03')

  await page.getByTestId('reset-button').click()
  await expect(display).toHaveText('01:05')
  await expect(page.getByTestId('start-button')).toBeEnabled()
  await page.clock.runFor(2000)
  await expect(display).toHaveText('01:05')
})

test('saves custom durations, transitions to rest, and preserves the count on reset', async ({ page }) => {
  await page.getByTestId('open-settings').click()
  await page.getByTestId('focus-duration').fill('2')
  await page.getByTestId('enable-breaks').check()
  await page.getByTestId('rest-duration').fill('3')
  await page.getByTestId('save-settings').click()
  await expect(page.getByTestId('settings-dialog')).not.toBeVisible()
  await expect(page.getByTestId('timer-display')).toHaveText('02:00')
  await page.getByTestId('start-button').click()
  await page.clock.runFor(120000)
  await expect(page.getByTestId('session-label')).toHaveText('Rest session')
  await expect(page.getByTestId('timer-display')).toHaveText('03:00')
  await expect(page.getByTestId('completed-count')).toHaveText('1')
  await expect(page.getByTestId('timer-status')).toHaveText('Ready')
  await expect(page.getByTestId('completion-message')).toContainText('Focus complete')
  await page.clock.runFor(2000)
  await expect(page.getByTestId('timer-display')).toHaveText('03:00')
  await page.getByTestId('start-button').click()
  await page.clock.runFor(1000)
  await page.getByTestId('reset-button').click()
  await expect(page.getByTestId('timer-display')).toHaveText('03:00')
  await expect(page.getByTestId('completed-count')).toHaveText('1')
  await page.reload()
  await expect(page.getByTestId('timer-display')).toHaveText('02:00')
  await expect(page.getByTestId('completed-count')).toHaveText('0')
})

test('rejects invalid settings without changing the timer and supports cancelling', async ({ page }) => {
  await page.getByTestId('open-settings').click()
  await page.getByTestId('focus-duration').fill('0')
  await page.getByTestId('save-settings').click()
  await expect(page.getByTestId('settings-error')).toContainText('minutes')
  await expect(page.getByTestId('timer-display')).toHaveText('01:05')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('settings-dialog')).not.toBeVisible()
  await expect(page.getByTestId('open-settings')).toBeFocused()
})

test('accepts minutes and restores them when reopening settings', async ({ page }) => {
  await page.getByTestId('open-settings').click()
  await page.getByTestId('focus-duration').fill('25')
  await page.getByTestId('save-settings').click()
  await expect(page.getByTestId('timer-display')).toHaveText('25:00')
  await page.reload()
  await expect(page.getByTestId('timer-display')).toHaveText('25:00')
  await page.getByTestId('open-settings').click()
  await expect(page.getByTestId('focus-duration')).toHaveValue('25')
  await page.getByTestId('focus-duration').fill('0.5')
  await page.getByTestId('save-settings').click()
  await expect(page.getByTestId('timer-display')).toHaveText('00:30')
})

test('finishes the standalone timer and can reset for another round', async ({ page }) => {
  await page.getByTestId('start-button').click()
  await page.clock.runFor(65000)
  await expect(page.getByTestId('timer-display')).toHaveText('00:00')
  await expect(page.getByTestId('timer-status')).toHaveText('Finished')
  await expect(page.getByTestId('start-button')).toBeDisabled()
  await expect(page.getByTestId('completed-count')).toHaveText('1')
  await page.getByTestId('reset-button').click()
  await expect(page.getByTestId('timer-status')).toHaveText('Ready')
  await expect(page.getByTestId('timer-display')).toHaveText('01:05')
})

test('takes a long rest at the configured frequency and switching modes does not count a completion', async ({ page }) => {
  await page.getByTestId('open-settings').click()
  await page.getByTestId('focus-duration').fill('1')
  await page.getByTestId('enable-breaks').check()
  await page.getByTestId('rest-duration').fill('1')
  await page.getByTestId('long-rest-duration').fill('3')
  await page.getByTestId('long-rest-frequency').fill('2')
  await page.getByTestId('save-settings').click()
  for (let session = 0; session < 3; session++) {
    await page.getByTestId('start-button').click()
    await page.clock.runFor(60000)
  }
  await expect(page.getByTestId('session-label')).toHaveText('Long rest session')
  await expect(page.getByTestId('completed-count')).toHaveText('2')
  await page.getByTestId('mode-focus').click()
  await expect(page.getByTestId('session-label')).toHaveText('Focus session')
  await expect(page.getByTestId('completed-count')).toHaveText('2')
})

test('supports keyboard shortcuts without intercepting typing', async ({ page }) => {
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('Space')
  await page.clock.runFor(1000)
  await expect(page.getByTestId('timer-display')).toHaveText('01:04')
  await page.keyboard.press('Space')
  await expect(page.getByTestId('timer-status')).toHaveText('Paused')
  await page.keyboard.press('r')
  await expect(page.getByTestId('timer-status')).toHaveText('Ready')
  await page.getByRole('textbox', { name: 'Focus task' }).fill('Read a chapter')
  await page.keyboard.press('Space')
  await expect(page.getByTestId('timer-status')).toHaveText('Ready')
})

test('handles unavailable or corrupted saved settings', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('pomodoro-settings-v1', '{broken'))
  await page.reload()
  await expect(page.getByTestId('timer-display')).toHaveText('01:05')
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new Error('Storage unavailable') }
  })
  await page.getByTestId('open-settings').click()
  await page.getByTestId('focus-duration').fill('12')
  await page.getByTestId('save-settings').click()
  await expect(page.getByTestId('timer-display')).toHaveText('12:00')
  await expect(page.getByText('Settings applied for this visit.', { exact: false })).toBeVisible()
})

test('applying settings stops the previous clock, while cancelling preserves it', async ({ page }) => {
  await page.getByTestId('start-button').click()
  await page.getByTestId('open-settings').click()
  await page.getByTestId('focus-duration').fill('12')
  await page.keyboard.press('Escape')
  await page.clock.runFor(1000)
  await expect(page.getByTestId('timer-display')).toHaveText('01:04')
  await page.getByTestId('open-settings').click()
  await page.getByTestId('focus-duration').fill('12')
  await page.getByTestId('save-settings').click()
  await page.clock.runFor(2000)
  await expect(page.getByTestId('timer-display')).toHaveText('12:00')
  await expect(page.getByTestId('timer-status')).toHaveText('Ready')
})

test('keeps the timer and settings usable on mobile without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(page.getByTestId('timer-display')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/timer-mobile.png', fullPage: true })
  await page.getByTestId('open-settings').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
  await expect(page.getByTestId('save-settings')).toBeInViewport()
  await page.screenshot({ path: 'test-results/settings-mobile.png', fullPage: true })
})
