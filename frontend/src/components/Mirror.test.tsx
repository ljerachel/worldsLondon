import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import Mirror from './Mirror'

const mocks = vi.hoisted(() => ({
  disconnect: vi.fn(),
  publish: vi.fn(),
  setPrompt: vi.fn(),
  setReferenceImage: vi.fn(),
  uploadFile: vi.fn(),
  sendEvent: vi.fn(),
  uploadSelfie: vi.fn(),
  stopTrack: vi.fn(),
  getUserMedia: vi.fn(),
  mainTrack: undefined as MediaStreamTrack | undefined,
}))

vi.mock('@reactor-models/x2', () => ({
  X2Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useX2: () => ({
    status: 'ready',
    disconnect: mocks.disconnect,
    publish: mocks.publish,
    setPrompt: mocks.setPrompt,
    setReferenceImage: mocks.setReferenceImage,
    uploadFile: mocks.uploadFile,
  }),
  useX2Track: () => mocks.mainTrack,
}))

vi.mock('../lib/api', () => ({
  api: {
    sendEvent: mocks.sendEvent,
    uploadSelfie: mocks.uploadSelfie,
  },
}))

const stream = {
  getVideoTracks: () => [{ stop: mocks.stopTrack }],
  getTracks: () => [{ stop: mocks.stopTrack }],
} as unknown as MediaStream

function renderMirror(onContinue = vi.fn()) {
  return {
    onContinue,
    ...render(<Mirror id="session-1" jwt="jwt-1" bag="brooklyn" onContinue={onContinue} />),
  }
}

async function stepIntoMirror() {
  fireEvent.click(screen.getByRole('button', { name: 'Step in front of the mirror' }))
  await act(async () => Promise.resolve())
  return userEvent.setup()
}

describe('Mirror', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    localStorage.clear()
    mocks.mainTrack = undefined
    mocks.getUserMedia.mockResolvedValue(stream)
    mocks.disconnect.mockResolvedValue(undefined)
    mocks.publish.mockResolvedValue(undefined)
    mocks.setPrompt.mockResolvedValue(undefined)
    mocks.setReferenceImage.mockResolvedValue(undefined)
    mocks.uploadFile.mockResolvedValue({ uploadId: 'look-1' })
    mocks.sendEvent.mockResolvedValue({ ok: true })
    mocks.uploadSelfie.mockResolvedValue({ selfie_url: '/selfie.jpg' })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: mocks.getUserMedia },
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => ({ drawImage: vi.fn() }),
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: (callback: BlobCallback) => callback(new Blob(['selfie'], { type: 'image/jpeg' })),
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['look'], { type: 'image/png' })) }))
  })

  it('waits for a branded camera gesture before acquiring or publishing media', async () => {
    const user = userEvent.setup()
    renderMirror()

    const enter = screen.getByRole('button', { name: 'Step in front of the mirror' })
    expect(enter).toHaveClass('min-h-14')
    expect(mocks.getUserMedia).not.toHaveBeenCalled()
    expect(mocks.publish).not.toHaveBeenCalled()

    await user.click(enter)

    await waitFor(() => expect(mocks.getUserMedia).toHaveBeenCalledOnce())
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledOnce())
  })

  it('shows three looks and navigates them by controls and swipe', async () => {
    renderMirror()
    const user = await stepIntoMirror()

    expect(screen.getByRole('heading', { name: 'Street confidence' })).toBeInTheDocument()
    expect(screen.getByText('Look 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Brooklyn Street confidence look board' })).toHaveAttribute(
      'src',
      '/looks/brooklyn-1.png',
    )

    await user.click(screen.getByRole('button', { name: 'Next look' }))
    expect(screen.getByRole('heading', { name: 'Modern tailoring' })).toBeInTheDocument()
    expect(screen.getByText('Look 2 of 3')).toBeInTheDocument()

    const mirror = screen.getByTestId('mirror-surface')
    fireEvent.touchStart(mirror, { touches: [{ clientX: 250 }] })
    fireEvent.touchEnd(mirror, { changedTouches: [{ clientX: 100 }] })
    expect(screen.getByRole('heading', { name: 'After dark' })).toBeInTheDocument()
    await waitFor(() => expect(api.sendEvent).toHaveBeenCalledWith('session-1', 'look', 2))
  })

  it('saves the selected look and confirms it on the real control', async () => {
    renderMirror()
    const user = await stepIntoMirror()

    await user.click(screen.getByRole('button', { name: 'Save look' }))

    expect(await screen.findByRole('button', { name: 'Look saved' })).toHaveTextContent('Saved')
    expect(api.sendEvent).toHaveBeenCalledWith('session-1', 'save', 0)
  })

  it('prevents duplicate save calls while a save is in flight', async () => {
    let resolveSave!: () => void
    mocks.sendEvent.mockReturnValueOnce(new Promise<void>((resolve) => { resolveSave = resolve }))
    renderMirror()
    await stepIntoMirror()

    const save = screen.getByRole('button', { name: 'Save look' })
    fireEvent.click(save)
    fireEvent.click(save)

    expect(api.sendEvent).toHaveBeenCalledTimes(1)
    resolveSave()
    await screen.findByRole('button', { name: 'Look saved' })
  })

  it('forces the live front-camera fallback immediately with a look-board PiP', async () => {
    localStorage.setItem('coach_no_reactor', '1')
    renderMirror()
    await stepIntoMirror()

    expect(screen.getByText('Live camera · Try in store')).toBeInTheDocument()
    expect(screen.getByTestId('source-webcam')).toHaveClass('opacity-100')
    expect(screen.getByRole('img', { name: 'Brooklyn Street confidence look board' })).toBeInTheDocument()
    await waitFor(() => expect(mocks.getUserMedia).toHaveBeenCalledTimes(1))
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it('shows the complete source and X2 frames without cropping on a Coach-black backdrop', async () => {
    renderMirror()
    await stepIntoMirror()

    for (const video of [screen.getByTestId('source-webcam'), screen.getByTestId('x2-output')]) {
      expect(video).toHaveClass('h-full', 'object-contain', 'bg-black')
      expect(video).toHaveStyle({ backgroundColor: '#0a0a0a' })
      expect(video).not.toHaveClass('object-cover')
    }
    expect(screen.getByTestId('source-webcam')).toHaveClass('scale-x-[-1]')
  })

  it('falls back and disconnects X2 after eight seconds without a frame', async () => {
    vi.useFakeTimers()
    renderMirror()
    await stepIntoMirror()

    expect(screen.getByText('Opening live try-on')).toBeInTheDocument()
    await act(async () => vi.advanceTimersByTimeAsync(8_000))

    expect(screen.getByText('Live camera · Try in store')).toBeInTheDocument()
    expect(mocks.getUserMedia).toHaveBeenCalledTimes(1)
    expect(mocks.disconnect).toHaveBeenCalledOnce()
  })

  it('disconnects X2 when setup or playback failure enters fallback', async () => {
    mocks.publish.mockRejectedValueOnce(new Error('publish failed'))
    renderMirror()
    await stepIntoMirror()

    await waitFor(() => expect(screen.getByText('Live camera · Try in store')).toBeInTheDocument())
    expect(mocks.disconnect).toHaveBeenCalledOnce()
  })

  it('starts the one-selfie timer only after source metadata is ready', async () => {
    vi.useFakeTimers()
    renderMirror()
    await stepIntoMirror()

    await act(async () => vi.advanceTimersByTimeAsync(3_000))
    expect(api.uploadSelfie).not.toHaveBeenCalled()

    fireEvent.loadedMetadata(screen.getByTestId('source-webcam'))
    await act(async () => vi.advanceTimersByTimeAsync(3_000))

    expect(api.uploadSelfie).toHaveBeenCalledTimes(1)
    expect(api.uploadSelfie).toHaveBeenCalledWith('session-1', expect.any(Blob))
    act(() => vi.advanceTimersByTime(3_000))
    expect(api.uploadSelfie).toHaveBeenCalledTimes(1)
  })

  it('disconnects X2, stops camera media, and continues to the film stage', async () => {
    const { onContinue } = renderMirror()
    const user = await stepIntoMirror()
    await waitFor(() => expect(mocks.getUserMedia).toHaveBeenCalledOnce())

    await user.click(screen.getByRole('button', { name: 'Continue to your chapter' }))

    await waitFor(() => expect(onContinue).toHaveBeenCalledOnce())
    expect(mocks.disconnect).toHaveBeenCalledOnce()
    expect(mocks.stopTrack).toHaveBeenCalled()
  })
})
