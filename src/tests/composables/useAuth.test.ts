// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import type { AuthCallback, Settings, User } from '@netlify/identity'
import * as identity from '@netlify/identity'
import { useAuth } from '../../composables/useAuth'

vi.mock('@netlify/identity', () => ({
  acceptInvite: vi.fn(), getSettings: vi.fn(), getUser: vi.fn(),
  handleAuthCallback: vi.fn(), login: vi.fn(), logout: vi.fn(),
  onAuthChange: vi.fn(), requestPasswordRecovery: vi.fn(),
  signup: vi.fn(), updateUser: vi.fn(),
}))
const account: User = { id: 'test-user', email: 'timer@example.com' }
const configuration: Settings = {
  autoconfirm: false, disableSignup: false,
  providers: { email: true, google: false, github: false, gitlab: false, bitbucket: false, facebook: false },
}

describe('useAuth', () => {
  let wrapper: VueWrapper | undefined
  let auth: ReturnType<typeof useAuth>
  let listener: AuthCallback
  const unsubscribe = vi.fn()
  async function setup() {
    wrapper = mount(defineComponent({ setup() { auth = useAuth(); return () => null } }))
    await flushPromises()
    return auth
  }
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(identity.getSettings).mockResolvedValue(configuration)
    vi.mocked(identity.getUser).mockResolvedValue(null)
    vi.mocked(identity.handleAuthCallback).mockResolvedValue(null)
    vi.mocked(identity.onAuthChange).mockImplementation((callback) => { listener = callback; return unsubscribe })
    vi.mocked(identity.login).mockResolvedValue(account)
    vi.mocked(identity.signup).mockResolvedValue(account)
    vi.mocked(identity.logout).mockResolvedValue(undefined)
    vi.mocked(identity.requestPasswordRecovery).mockResolvedValue(undefined)
    vi.mocked(identity.updateUser).mockResolvedValue(account)
    vi.mocked(identity.acceptInvite).mockResolvedValue(account)
  })
  afterEach(() => wrapper?.unmount())

  it('restores the existing account and unsubscribes on unmount', async () => {
    vi.mocked(identity.getUser).mockResolvedValue(account)
    const auth = await setup()
    expect(auth.user.value).toEqual(account)
    expect(auth.loading.value).toBe(false)
    listener('logout', null)
    expect(auth.user.value).toBeNull()
    wrapper!.unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
    wrapper = undefined
  })
  it('leaves guests usable when Identity is unavailable', async () => {
    vi.mocked(identity.getSettings).mockRejectedValue(new Error('offline'))
    const auth = await setup()
    expect(auth.settings.value).toBeNull()
    expect(auth.loading.value).toBe(false)
    expect(auth.error.value).toBe('')
    expect(await auth.submit('timer@example.com', 'a-password')).toBe(false)
    expect(identity.login).not.toHaveBeenCalled()
  })
  it('signs in and signs out without owning timer state', async () => {
    const auth = await setup()
    expect(await auth.submit('timer@example.com', 'a-password')).toBe(true)
    expect(identity.login).toHaveBeenCalledWith('timer@example.com', 'a-password')
    expect(auth.user.value).toEqual(account)
    await auth.signOut()
    expect(identity.logout).toHaveBeenCalledOnce()
    expect(auth.user.value).toBeNull()
  })
  it('reports failed sign-in and releases the busy state', async () => {
    vi.mocked(identity.login).mockRejectedValue(new Error('invalid credentials'))
    const auth = await setup()
    expect(await auth.submit('timer@example.com', 'bad-password')).toBe(false)
    expect(auth.user.value).toBeNull()
    expect(auth.error.value).toContain('Could not sign in')
    expect(auth.busy.value).toBe(false)
  })
  it('requires email confirmation for normal registration', async () => {
    const auth = await setup()
    auth.changeMode('signup')
    expect(await auth.submit('timer@example.com', 'a-password')).toBe(false)
    expect(identity.signup).toHaveBeenCalledWith('timer@example.com', 'a-password')
    expect(auth.user.value).toBeNull()
    expect(auth.notice.value).toContain('confirmation link')
  })
  it('supports automatic confirmation when configured by the site owner', async () => {
    vi.mocked(identity.getSettings).mockResolvedValue({ ...configuration, autoconfirm: true })
    const auth = await setup()
    auth.changeMode('signup')
    expect(await auth.submit('timer@example.com', 'a-password')).toBe(true)
    expect(auth.user.value).toEqual(account)
  })
  it('respects invite-only registration', async () => {
    vi.mocked(identity.getSettings).mockResolvedValue({ ...configuration, disableSignup: true })
    const auth = await setup()
    auth.changeMode('signup')
    expect(await auth.submit('timer@example.com', 'a-password')).toBe(false)
    expect(identity.signup).not.toHaveBeenCalled()
  })
  it('sends a recovery link without disclosing whether an email has an account', async () => {
    const auth = await setup()
    auth.changeMode('recovery')
    await auth.submit('timer@example.com', '')
    expect(identity.requestPasswordRecovery).toHaveBeenCalledWith('timer@example.com')
    expect(auth.notice.value).toContain('If an account exists')
  })
  it('completes a recovery callback with a new password', async () => {
    vi.mocked(identity.handleAuthCallback).mockResolvedValue({ type: 'recovery', user: account })
    const auth = await setup()
    expect(auth.mode.value).toBe('password')
    expect(auth.openRequested.value).toBe(true)
    expect(await auth.submit('', 'new-password')).toBe(true)
    expect(identity.updateUser).toHaveBeenCalledWith({ password: 'new-password' })
  })
  it('accepts an invite using its callback token', async () => {
    vi.mocked(identity.handleAuthCallback).mockResolvedValue({ type: 'invite', user: null, token: 'test-invite' })
    const auth = await setup()
    expect(await auth.submit('', 'new-password')).toBe(true)
    expect(identity.acceptInvite).toHaveBeenCalledWith('test-invite', 'new-password')
    expect(auth.user.value).toEqual(account)
  })
  it('restores a confirmed account from an email callback', async () => {
    vi.mocked(identity.handleAuthCallback).mockResolvedValue({ type: 'confirmation', user: account })
    const auth = await setup()
    expect(auth.user.value).toEqual(account)
    expect(auth.openRequested.value).toBe(false)
  })
  it('shows an expired callback error without blocking initialization', async () => {
    vi.mocked(identity.handleAuthCallback).mockRejectedValue(new Error('expired'))
    const auth = await setup()
    expect(auth.error.value).toContain('Request a new link')
    expect(auth.openRequested.value).toBe(true)
    expect(auth.loading.value).toBe(false)
  })
  it('keeps the real session visible if signing out fails', async () => {
    vi.mocked(identity.getUser).mockResolvedValue(account)
    vi.mocked(identity.logout).mockRejectedValue(new Error('offline'))
    const auth = await setup()
    await auth.signOut()
    expect(auth.user.value).toEqual(account)
    expect(auth.error.value).toContain('Could not finish signing out')
  })
})
