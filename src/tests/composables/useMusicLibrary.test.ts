// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { refreshSession } from '@netlify/identity'
import { useMusicLibrary } from '../../composables/useMusicLibrary'
import type { MusicAccount } from '../../composables/useMusicLibrary'

vi.mock('@netlify/identity', () => ({ refreshSession: vi.fn() }))
const song = 'https://music.youtube.com/watch?v=abcdefghijk'
const user = ref<MusicAccount>(null)
const fetchMock = vi.fn()
let library: ReturnType<typeof useMusicLibrary>
let wrapper: ReturnType<typeof mount>
const response = (entries: unknown[] = [], status = 200) => new Response(JSON.stringify({ entries }), { status })
async function setup() {
  wrapper = mount(defineComponent({ setup() { library = useMusicLibrary(user); return () => null } }))
  await flushPromises()
}
beforeEach(() => {
  vi.stubEnv('DEV', false)
  localStorage.clear()
  user.value = null
  fetchMock.mockReset().mockResolvedValue(response())
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(refreshSession).mockResolvedValue('renewed')
})
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

it('never loads shared browser storage or contacts the API for guests', async () => {
  localStorage.setItem('pomodoro-music-library-v1', JSON.stringify([{ name: 'Someone else', url: song }]))
  await setup()
  expect(library.entries.value).toEqual([])
  expect(await library.save(song, 'Focus')).toBe(false)
  expect(fetchMock).not.toHaveBeenCalled()
})

it('loads and mutates the account library with canonical links, without sending a user ID', async () => {
  user.value = { id: 'alice' }
  await setup()
  fetchMock.mockResolvedValueOnce(response([{ name: 'Focus', url: song }]))
  expect(await library.save('https://youtu.be/abcdefghijk?si=share', 'Focus')).toBe(true)
  expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({ type: 'save', url: song, name: 'Focus' })
  expect(library.entries.value).toEqual([{ name: 'Focus', url: song }])
  fetchMock.mockResolvedValueOnce(response())
  expect(await library.remove(song)).toBe(true)
  expect(library.entries.value).toEqual([])
})

it('clears entries immediately on account changes and ignores a late response from the previous account', async () => {
  user.value = { id: 'alice' }
  fetchMock.mockResolvedValueOnce(response([{ name: 'Private', url: song }]))
  await setup()
  expect(library.entries.value).toHaveLength(1)
  let finish!: (value: Response) => void
  fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
  const pending = library.save(song, 'Updated')
  user.value = { id: 'bob' }
  expect(library.entries.value).toEqual([])
  await flushPromises()
  finish(response([{ name: 'Private Alice', url: song }]))
  await pending
  expect(library.entries.value).toEqual([])
  user.value = null
  expect(library.ready.value).toBe(false)
})

it('keeps failed writes out of the library and supports retrying a failed load', async () => {
  user.value = { id: 'alice' }
  fetchMock.mockResolvedValueOnce(response([], 503))
  await setup()
  expect(library.disabled.value).toBe(true)
  expect(await library.reload()).toBe(true)
  fetchMock.mockResolvedValueOnce(response([], 503))
  expect(await library.save(song, 'Focus')).toBe(false)
  expect(library.entries.value).toEqual([])
  expect(library.notice.value).toContain('Could not update')
})

it('refreshes expired authentication once and hides private entries if still rejected', async () => {
  user.value = { id: 'alice' }
  fetchMock.mockResolvedValueOnce(response([{ name: 'Private', url: song }]))
  await setup()
  fetchMock.mockResolvedValueOnce(response([], 401)).mockResolvedValueOnce(response([], 401))
  expect(await library.remove(song)).toBe(false)
  expect(refreshSession).toHaveBeenCalled()
  expect(library.expired.value).toBe(true)
  expect(library.entries.value).toEqual([])
  fetchMock.mockResolvedValueOnce(response([{ name: 'Private', url: song }]))
  user.value = { id: 'alice' }
  await flushPromises()
  expect(library.expired.value).toBe(false)
  expect(library.entries.value).toHaveLength(1)
})

it('supports a persistent guest development library without any API or authentication calls', async () => {
  vi.stubEnv('DEV', true)
  await setup()
  expect(library.localDev.value).toBe(true)
  expect(library.disabled.value).toBe(false)
  await library.save(song, 'Dev focus')
  await library.save('https://youtu.be/abcdefghijk', 'Renamed')
  expect(library.entries.value).toEqual([{ name: 'Renamed', url: song }])
  wrapper.unmount()
  await setup()
  expect(library.entries.value).toEqual([{ name: 'Renamed', url: song }])
  await library.remove(song)
  wrapper.unmount()
  await setup()
  expect(library.entries.value).toEqual([])
  expect(fetchMock).not.toHaveBeenCalled()
})

it('keeps the development library separate from account data on sign-in and sign-out', async () => {
  vi.stubEnv('DEV', true)
  await setup()
  await library.save(song, 'Dev only')
  user.value = { id: 'alice' }
  expect(library.entries.value).toEqual([])
  await flushPromises()
  expect(library.localDev.value).toBe(false)
  expect(library.entries.value).toEqual([])
  user.value = null
  expect(library.localDev.value).toBe(true)
  expect(library.entries.value).toEqual([{ name: 'Dev only', url: song }])
})
