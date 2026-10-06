import { expect, test } from '@playwright/test'
import type { Browser, BrowserContext, Page } from '@playwright/test'
import { applyTimerCommand, freshTimer, reconcileTimer } from '../src/domain/sharedTimer'
import type { SharedTimerState } from '../src/domain/sharedTimer'

test('loads shared account timers on sign-in and reload, with no background polling', async ({ browser, baseURL }) => {
  let serverNow = Date.parse('2026-01-01T00:01:00Z')
  const saved = new Map<string, { state: SharedTimerState; revision: number }>()
  const contexts: BrowserContext[] = []
  let requestCount = 0
  async function device(browser: Browser, id: string, clockSkew = 0) {
    const context = await browser.newContext({ baseURL })
    contexts.push(context)
    const page = await context.newPage()
    const user = { id, email: `${id}@example.com`, user_metadata: { full_name: id }, app_metadata: {} }
    const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: 4_000_000_000 })).toString('base64url')}.test`
    await page.route('**/.netlify/identity/**', route => {
      const path = new URL(route.request().url()).pathname.split('/').at(-1)
      return route.fulfill({ json: path === 'settings' ? { autoconfirm: false, disable_signup: false, external: { email: true } }
        : path === 'token' ? { access_token: token, refresh_token: 'test', expires_in: 3600, token_type: 'bearer' } : user })
    })
    await page.route('**/.netlify/functions/timer', async route => {
      requestCount++
      const row = saved.get(id) ?? { state: freshTimer(), revision: 0 }
      const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null
      if (body && body.revision !== row.revision) {
        await route.fulfill({ status: 409, json: { ...row, serverNow } })
        return
      }
      const next = body ? applyTimerCommand(row.state, body.command, serverNow) : reconcileTimer(row.state, serverNow)
      if (next !== row.state) row.revision++
      row.state = next
      saved.set(id, row)
      await route.fulfill({ json: { ...row, serverNow } })
    })
    const now = new Date(serverNow - 60000 + clockSkew)
    await page.clock.install({ time: now })
    await page.clock.pauseAt(new Date(serverNow + clockSkew))
    await page.goto('/')
    await page.getByTestId('open-account').click()
    await page.getByTestId('auth-email').fill(user.email)
    await page.getByTestId('auth-password').fill('test-password')
    await page.getByTestId('auth-submit').click()
    await expect(page.getByTestId('sync-status')).toHaveText('Account timer loaded')
    return page
  }
  async function advance(pages: Page[], milliseconds: number) {
    serverNow += milliseconds
    await Promise.all(pages.map(page => page.clock.runFor(milliseconds)))
  }
  try {
    const pc = await device(browser, 'ash')
    await pc.getByTestId('start-button').click()
    await expect(pc.getByTestId('timer-status')).toHaveText('Running')
    await advance([pc], 3000)
    expect(requestCount).toBe(2)
    // A clock ten minutes fast must not change the shared remaining time.
    const phone = await device(browser, 'ash', 600000)
    const otherUser = await device(browser, 'someone-else')
    expect(requestCount).toBe(4)
    await expect(phone.getByTestId('timer-status')).toHaveText('Running')
    await expect(phone.getByTestId('timer-display')).toHaveText('24:57')
    await expect(pc.getByTestId('timer-display')).toHaveText('24:57')
    await expect(otherUser.getByTestId('timer-status')).toHaveText('Ready')
    await phone.getByTestId('pause-button').click()
    await expect(phone.getByTestId('timer-status')).toHaveText('Paused')
    await advance([pc, phone], 3000)
    // An already-open device learns remote actions only when explicitly reloaded.
    await expect(pc.getByTestId('timer-status')).toHaveText('Running')
    await expect(pc.getByTestId('timer-display')).toHaveText('24:54')
    expect(requestCount).toBe(5)
    await pc.reload()
    await expect(pc.getByTestId('timer-status')).toHaveText('Paused')
    await expect(pc.getByTestId('timer-display')).toHaveText('24:57')
    await pc.getByTestId('start-button').click()
    await expect(pc.getByTestId('timer-status')).toHaveText('Running')
    await phone.reload()
    await expect(phone.getByTestId('timer-status')).toHaveText('Running')
    await advance([pc, phone], 3000)
    await expect(phone.getByTestId('timer-display')).toHaveText('24:54')
    await phone.getByTestId('reset-button').click()
    await expect(phone.getByTestId('timer-status')).toHaveText('Ready')
    await advance([pc, phone], 3000)
    await pc.reload()
    await expect(pc.getByTestId('timer-display')).toHaveText('25:00')
    await expect(pc.getByTestId('timer-status')).toHaveText('Ready')
    await pc.getByTestId('open-settings').click()
    await pc.getByTestId('focus-duration').fill('0.1')
    await pc.getByTestId('save-settings').click()
    await expect(pc.getByTestId('settings-dialog')).not.toBeVisible()
    await phone.reload()
    await expect(phone.getByTestId('timer-display')).toHaveText('00:06')
    await phone.getByTestId('start-button').click()
    await expect(phone.getByTestId('timer-status')).toHaveText('Running')
    const beforeCompletion = requestCount
    await advance([pc, phone], 6000)
    expect(requestCount).toBe(beforeCompletion)
    await expect(pc.getByTestId('completed-count')).toHaveText('0')
    await expect(phone.getByTestId('completed-count')).toHaveText('1')
    await pc.reload()
    await expect(pc.getByTestId('completed-count')).toHaveText('1')
    await expect(pc.getByTestId('session-label')).toHaveText('Rest session')
    await phone.reload()
    await expect(phone.getByTestId('session-label')).toHaveText('Rest session')
    await expect(phone.getByTestId('completed-count')).toHaveText('1')
  } finally {
    await Promise.all(contexts.map(context => context.close()))
  }
})
