// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import type { User } from '@netlify/identity'
import { usePomodoro } from '../../composables/usePomodoro'
import { useTimerSync } from '../../composables/useTimerSync'
import { freshTimer } from '../../domain/sharedTimer'

describe('timer synchronization lifecycle', () => {
  let wrapper: VueWrapper | undefined
  const fetchMock = vi.fn()
  const save = vi.fn()
  let timer: ReturnType<typeof usePomodoro>
  let sync: ReturnType<typeof useTimerSync>
  const user = ref<User | null>(null)
  function response(revision = 0, status = 200) {
    return new Response(JSON.stringify({ state: freshTimer(), revision, serverNow: Date.now() }), { status })
  }
  async function setup() {
    wrapper = mount(defineComponent({ setup() {
      timer = usePomodoro(65)
      sync = useTimerSync(user, timer, save)
      return () => null
    } }))
    await flushPromises()
  }
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset().mockImplementation(() => Promise.resolve(response()))
    save.mockReset()
    user.value = null
  })
  afterEach(() => {
    wrapper?.unmount()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  it('does not contact storage for guests', async () => {
    await setup()
    timer.start()
    await vi.advanceTimersByTimeAsync(3000)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(timer.remainingSeconds.value).toBe(62)
    expect(sync.disabled.value).toBe(false)
  })
  it('loads account state once without timer, focus, visibility, or online polling', async () => {
    user.value = { id: 'ash' }
    await setup()
    expect(timer.remainingSeconds.value).toBe(1500)
    expect(sync.message.value).toBe('Account timer loaded')
    await vi.advanceTimersByTimeAsync(3600000)
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('online'))
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledOnce()
    user.value = null
    await flushPromises()
    await vi.advanceTimersByTimeAsync(6000)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(sync.message.value).toBe('')
  })
  it('submits commands with the last server revision and reconciles conflicts', async () => {
    user.value = { id: 'ash' }
    fetchMock.mockResolvedValueOnce(response(5))
    await setup()
    fetchMock.mockResolvedValueOnce(response(6, 409))
    expect(await sync.request({ type: 'start' })).toBe(false)
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({ revision: 5, command: { type: 'start' } })
    expect(sync.message.value).toContain('another device')
    expect(timer.status.value).toBe('ready')
  })
  it('keeps controls enabled while a loaded account timer counts down locally', async () => {
    user.value = { id: 'ash' }
    await setup()
    timer.start()
    await vi.advanceTimersByTimeAsync(3000)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(sync.busy.value).toBe(false)
    expect(sync.disabled.value).toBe(false)
    expect(timer.remainingSeconds.value).toBe(1497)
  })
  it('sends one command per action and prevents duplicate requests while saving', async () => {
    user.value = { id: 'ash' }
    await setup()
    let finishSave!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finishSave = resolve }))
    const saving = sync.request({ type: 'reset' })
    expect(sync.disabled.value).toBe(true)
    expect(await sync.request({ type: 'reset' })).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({ revision: 0, command: { type: 'reset' } })
    finishSave(response(1))
    expect(await saving).toBe(true)
    expect(sync.busy.value).toBe(false)
    expect(sync.disabled.value).toBe(false)
  })
  it('reports offline failures without automatic retries and allows a manual retry', async () => {
    user.value = { id: 'ash' }
    await setup()
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    expect(await sync.request({ type: 'start' })).toBe(false)
    expect(sync.message.value).toContain('Could not save')
    expect(timer.status.value).toBe('ready')
    await vi.advanceTimersByTimeAsync(60000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(await sync.request({ type: 'start' })).toBe(true)
    expect(sync.message.value).toBe('Timer saved to your account')
  })
  it('ignores a late response after signing out', async () => {
    let resolve!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done }))
    user.value = { id: 'ash' }
    await setup()
    user.value = null
    await flushPromises()
    resolve(response())
    await flushPromises()
    expect(timer.remainingSeconds.value).toBe(65)
    expect(save).not.toHaveBeenCalled()
  })
  it('rejects malformed responses and cleans up pending requests on unmount', async () => {
    user.value = { id: 'ash' }
    fetchMock.mockResolvedValueOnce(new Response('{"state":{}}'))
    await setup()
    expect(sync.message.value).toContain('Could not load')
    expect(timer.remainingSeconds.value).toBe(65)
    wrapper!.unmount()
    wrapper = undefined
    await vi.advanceTimersByTimeAsync(6000)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
