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
