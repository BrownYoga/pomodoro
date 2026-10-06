import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
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
