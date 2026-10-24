import { expect, test } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import { applyTimerCommand, freshTimer, reconcileTimer } from '../src/domain/sharedTimer'
import type { SharedTimerState } from '../src/domain/sharedTimer'

test('automatically syncs pause, resume, reset and settings across devices without reloading', async ({ browser, baseURL }) => {
  let serverNow = Date.parse('2026-01-01T00:01:00Z')
  const saved = new Map<string, { state: SharedTimerState; revision: number }>()
  const contexts: BrowserContext[] = []
  async function device(id: string, clockSkew = 0) {
    const context = await browser.newContext({ baseURL })
    contexts.push(context)
    const page = await context.newPage()
    const user = { id, email: `${id}@example.com`, user_metadata: { full_name: id }, app_metadata: {} }
    const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: 4_000_000_000 })).toString('base64url')}.test`
    await page.route('**/.netlify/identity/**', route => {
      const path = new URL(route.request().url()).pathname.split('/').at(-1)
      return route.fulfill({ json: path === 'settings' ? { autoconfirm: false, external: { email: true } }
        : path === 'token' ? { access_token: token, refresh_token: 'test', expires_in: 3600, token_type: 'bearer' } : user })
    })
    await page.route('**/.netlify/functions/music-library', route => route.fulfill({ json: { entries: [] } }))
    await page.route('**/.netlify/functions/timer', async route => {
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
    await page.clock.install({ time: new Date(serverNow - 60000 + clockSkew) })
    await page.clock.pauseAt(new Date(serverNow + clockSkew))
    await page.goto('/')
    await page.getByTestId('open-account').click()
    await page.getByTestId('auth-email').fill(user.email)
    await page.getByTestId('auth-password').fill('test-password')
    await page.getByTestId('auth-submit').click()
    await expect(page.getByTestId('sync-status')).toHaveText('Account timer loaded')
    return page
  }
  async function advance(pages: Page[], milliseconds = 5000) {
    serverNow += milliseconds
    await Promise.all(pages.map(page => page.clock.runFor(milliseconds)))
  }
  try {
    const pc = await device('ash')
    const phone = await device('ash', 600000)
    const other = await device('someone-else')
    await pc.getByTestId('start-button').click()
    await expect(pc.getByTestId('timer-status')).toHaveText('Running')
    await advance([pc, phone, other])
    await expect(phone.getByTestId('timer-status')).toHaveText('Running')
    await expect(phone.getByTestId('timer-display')).toHaveText('24:55')
    await expect(other.getByTestId('timer-status')).toHaveText('Ready')
    await phone.getByTestId('pause-button').click()
    await expect(phone.getByTestId('timer-status')).toHaveText('Paused')
    await advance([pc, phone])
    await expect(pc.getByTestId('timer-status')).toHaveText('Paused')
    await expect(pc.getByTestId('timer-display')).toHaveText('24:55')
    await pc.getByTestId('start-button').click()
    await expect(pc.getByTestId('timer-status')).toHaveText('Running')
    await advance([pc, phone])
    await expect(phone.getByTestId('timer-status')).toHaveText('Running')
    await expect(phone.getByTestId('timer-display')).toHaveText('24:50')
    await phone.getByTestId('reset-button').click()
    await expect(phone.getByTestId('timer-status')).toHaveText('Ready')
    await advance([pc, phone])
    await expect(pc.getByTestId('timer-status')).toHaveText('Ready')
    await expect(pc.getByTestId('timer-display')).toHaveText('25:00')
    await pc.getByTestId('open-settings').click()
    await pc.getByTestId('focus-duration').fill('0.1')
    await pc.getByTestId('save-settings').click()
    await expect(pc.getByTestId('settings-dialog')).not.toBeVisible()
    await advance([pc, phone])
    await expect(phone.getByTestId('timer-display')).toHaveText('00:06')
    await phone.getByTestId('start-button').click()
    await expect(phone.getByTestId('timer-status')).toHaveText('Running')
    await advance([pc, phone])
    await expect(pc.getByTestId('timer-status')).toHaveText('Running')
    await advance([pc, phone])
    await expect(pc.getByTestId('completed-count')).toHaveText('1')
    await expect(phone.getByTestId('completed-count')).toHaveText('1')
    await expect(pc.getByTestId('session-label')).toHaveText('Rest session')
    await expect(phone.getByTestId('session-label')).toHaveText('Rest session')
    await phone.getByTestId('open-settings').click()
    await phone.getByTestId('enable-sound').check()
    await phone.getByTestId('save-settings').click()
    await expect(phone.getByTestId('settings-dialog')).not.toBeVisible()
    await advance([pc, phone])
    await pc.getByTestId('open-settings').click()
    await expect(pc.getByTestId('enable-sound')).toBeChecked()
  } finally { await Promise.all(contexts.map(context => context.close())) }
})
