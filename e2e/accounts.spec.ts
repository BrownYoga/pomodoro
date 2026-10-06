import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const account = { id: 'e2e-user', email: 'timer@example.com', user_metadata: {}, app_metadata: { provider: 'email' } }
// Fictional session used only by intercepted HTTP responses. No live service is contacted.
const jwt = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: account.id, exp: 4_000_000_000 })).toString('base64url')}.test-signature`

async function mockIdentity(page: Page, options: { unavailable?: boolean; invalidLogin?: boolean; inviteOnly?: boolean } = {}, landingPath = '/') {
  await page.route('**/.netlify/identity/**', async (route) => {
    const path = new URL(route.request().url()).pathname.split('/').at(-1)
    if (options.unavailable) {
      await route.fulfill({ status: 503, json: { msg: 'unavailable' } })
    } else if (path === 'settings') {
      await route.fulfill({ json: { autoconfirm: false, disable_signup: options.inviteOnly ?? false, external: { email: true } } })
    } else if (path === 'token' || path === 'verify') {
      await route.fulfill(options.invalidLogin
        ? { status: 400, json: { error: 'invalid_grant', error_description: 'Invalid credentials' } }
        : { json: { access_token: jwt, refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 3600 } })
    } else if (path === 'user' || path === 'signup') {
      await route.fulfill({ json: account })
    } else if (path === 'logout' || path === 'recover') {
      await route.fulfill({ json: {} })
    } else {
      await route.fulfill({ status: 404, json: { msg: 'Unexpected test endpoint' } })
    }
  })
  const now = new Date('2026-01-01T00:00:00Z')
  await page.clock.install({ time: now })
  await page.clock.pauseAt(new Date(now.getTime() + 60_000))
  await page.goto(landingPath)
}

test('signs in, restores the account on reload, and signs out without resetting the timer', async ({ page }) => {
  await mockIdentity(page)
  await page.getByTestId('start-button').click()
  await page.clock.runFor(1000)
  await page.getByTestId('open-account').click()
  await page.getByTestId('auth-email').fill('timer@example.com')
  await page.getByTestId('auth-password').fill('test-password')
  await page.getByTestId('auth-submit').click()
  await expect(page.getByTestId('account-dialog')).not.toBeVisible()
  await expect(page.getByTestId('account-email')).toHaveText(account.email)
  await expect(page.getByTestId('timer-status')).toHaveText('Running')
  await expect(page.getByTestId('timer-display')).toHaveText('24:59')
  await page.reload()
  await expect(page.getByTestId('account-email')).toHaveText(account.email)
  await page.getByTestId('start-button').click()
  await page.clock.runFor(2000)
  await page.getByTestId('sign-out').click()
  await expect(page.getByTestId('open-account')).toBeVisible()
  await expect(page.getByTestId('timer-display')).toHaveText('24:58')
  await expect(page.getByTestId('timer-status')).toHaveText('Running')
  await page.reload()
  await expect(page.getByTestId('open-account')).toBeVisible()
})

test('shows a sign-in error and allows another attempt', async ({ page }) => {
  await mockIdentity(page, { invalidLogin: true })
  await page.getByTestId('open-account').click()
  await page.getByTestId('auth-email').fill('timer@example.com')
  await page.getByTestId('auth-password').fill('wrong-password')
  await page.getByTestId('auth-submit').click()
  await expect(page.getByTestId('auth-error')).toContainText('Could not sign in')
  await expect(page.getByTestId('auth-submit')).toBeEnabled()
  await expect(page.getByTestId('auth-password')).toHaveValue('')
  await page.getByTestId('close-account').click()
  await expect(page.getByTestId('open-account')).toBeFocused()
})

test('shows email confirmation instructions and supports requesting a recovery link', async ({ page }) => {
  await mockIdentity(page)
  await page.getByTestId('open-account').click()
  await page.getByTestId('create-account').click()
  await page.getByTestId('auth-email').fill('timer@example.com')
  await page.getByTestId('auth-password').fill('test-password')
  await page.getByTestId('auth-submit').click()
  await expect(page.getByTestId('auth-notice')).toContainText('confirmation link')
  await expect(page.getByTestId('account-email')).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to sign in' }).click()
  await page.getByTestId('forgot-password').click()
  await page.getByTestId('auth-submit').click()
  await expect(page.getByTestId('auth-notice')).toContainText('If an account exists')
})

test('keeps the guest timer usable when Identity is unavailable', async ({ page }) => {
  await mockIdentity(page, { unavailable: true })
  await page.getByTestId('open-account').click()
  await expect(page.getByTestId('auth-unavailable')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByTestId('start-button').click()
  await page.clock.runFor(1000)
  await expect(page.getByTestId('timer-display')).toHaveText('24:59')
})

test('keeps the account dialog within a mobile screen and respects invite-only registration', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await mockIdentity(page, { inviteOnly: true })
  await page.getByTestId('open-account').click()
  await expect(page.getByTestId('auth-email')).toBeVisible()
  await expect(page.getByTestId('create-account')).toHaveCount(0)
  // Keyboard shortcuts must not reset or start a timer behind an account dialog.
  await page.getByRole('heading', { name: 'Welcome back' }).click()
  await page.keyboard.press('Space')
  await expect(page.getByTestId('timer-status')).toHaveText('Ready')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const bounds = await page.getByTestId('account-dialog').boundingBox()
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(812)
  await page.screenshot({ path: 'test-results/account-mobile.png' })
})

for (const callback of ['recovery', 'invite'] as const) {
  test(`opens a new-password form from an email ${callback} link`, async ({ page }) => {
    await mockIdentity(page, {}, `/#${callback}_token=e2e-link`)
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
    await page.getByTestId('auth-password').fill('new-test-password')
    await page.getByTestId('auth-submit').click()
    await expect(page.getByTestId('account-dialog')).not.toBeVisible()
    await expect(page.getByTestId('account-email')).toHaveText(account.email)
  })
}

test('confirms an account from its email link', async ({ page }) => {
  await mockIdentity(page, {}, '/#confirmation_token=e2e-link')
  await expect(page.getByTestId('account-email')).toHaveText(account.email)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('timer-display')).toHaveText('25:00')
})
