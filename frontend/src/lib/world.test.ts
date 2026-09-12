import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openWorld, WorldCleanupError } from './world'

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  uploadFile: vi.fn(),
  sendCommand: vi.fn(),
}))

vi.mock('@reactor-team/js-sdk', () => ({
  Reactor: class MockReactor {
    connect = mocks.connect
    disconnect = mocks.disconnect
    on = mocks.on
    uploadFile = mocks.uploadFile
    sendCommand = mocks.sendCommand
  },
}))

describe('openWorld', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.connect.mockResolvedValue(undefined)
    mocks.disconnect.mockResolvedValue(undefined)
    mocks.uploadFile.mockRejectedValue(new Error('upload failed'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(['anchor'], { type: 'image/png' })) }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('distinguishes failed cleanup from a safely disconnected setup error', async () => {
    mocks.disconnect.mockRejectedValue(new Error('disconnect failed'))
    await expect(openWorld({
      jwt: 'jwt-1',
      anchorUrl: '/anchor.png',
      prompt: 'London street',
      videoEl: document.createElement('video'),
    })).rejects.toBeInstanceOf(WorldCleanupError)
    expect(mocks.disconnect).toHaveBeenCalledOnce()
  })

  it('keeps a failed open pending until its disconnect is confirmed', async () => {
    let finishDisconnect!: () => void
    mocks.connect.mockRejectedValue(new Error('connect failed'))
    mocks.disconnect.mockReturnValue(new Promise<void>((resolve) => { finishDisconnect = resolve }))
    const settled = vi.fn()
    const opening = openWorld({
      jwt: 'jwt-1',
      anchorUrl: '/anchor.png',
      prompt: 'London street',
      videoEl: document.createElement('video'),
    })
    void opening.then(settled, settled)
    await Promise.resolve()
    expect(mocks.disconnect).toHaveBeenCalledOnce()
    expect(settled).not.toHaveBeenCalled()
    finishDisconnect()
    await expect(opening).rejects.toThrow('connect failed')
    expect(mocks.disconnect).toHaveBeenCalledOnce()
  })

  it('sets a gentle rotation speed before starting the live world', async () => {
    mocks.uploadFile.mockResolvedValue({ id: 'anchor' })
    await openWorld({
      jwt: 'jwt-1',
      anchorUrl: '/anchor.png',
      prompt: 'London street',
      videoEl: document.createElement('video'),
    })

    expect(mocks.sendCommand.mock.calls).toEqual([
      ['set_image', { image: { id: 'anchor' } }],
      ['set_prompt', { prompt: 'London street' }],
      ['set_rotation_speed_deg', { rotation_speed_deg: 1 }],
      ['start', {}],
    ])
  })

  it('disconnects and rethrows when setup fails after connecting', async () => {
    await expect(openWorld({
      jwt: 'jwt-1',
      anchorUrl: '/anchor.png',
      prompt: 'London street',
      videoEl: document.createElement('video'),
    })).rejects.toThrow('upload failed')

    expect(mocks.connect).toHaveBeenCalledWith('jwt-1')
    expect(mocks.disconnect).toHaveBeenCalledOnce()
  })
})
