import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COACH } from '../data/config'
import type { Session } from '../lib/api'
import type { ImmersiveWorldProps } from '../components/ImmersiveWorld'
import { WorldCleanupError } from '../lib/world'
import Play from './Play'

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  getImmersiveWorld: vi.fn(),
  reactorToken: vi.fn(),
  sendAnswers: vi.fn(),
  sendEvent: vi.fn(),
  uploadSelfie: vi.fn(),
  startFilm: vi.fn(),
  openWorld: vi.fn(),
  move: vi.fn(),
  strafe: vi.fn(),
  look: vi.fn(),
  steer: vi.fn(),
  close: vi.fn(),
  retryResult: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  api: {
    createSession: mocks.createSession,
    getImmersiveWorld: mocks.getImmersiveWorld,
    reactorToken: mocks.reactorToken,
    sendAnswers: mocks.sendAnswers,
    sendEvent: mocks.sendEvent,
    uploadSelfie: mocks.uploadSelfie,
    startFilm: mocks.startFilm,
  },
}))

vi.mock('../lib/world', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/world')>(),
  openWorld: mocks.openWorld,
}))

vi.mock('../components/ImmersiveWorld', () => ({
  default: ({ jwt, onViewProduct, onRetryToken }: ImmersiveWorldProps) => (
    <section data-testid="immersive-world" data-jwt={jwt ?? 'fallback'}>
      <button type="button" onClick={() => { void onRetryToken?.().then(mocks.retryResult) }}>Retry live garden</button>
      <button type="button" onClick={() => onViewProduct('tabby')}>Explore Tabby</button>
      <button type="button" onClick={() => onViewProduct('brooklyn')}>Explore Brooklyn</button>
    </section>
  ),
}))

const session: Session = {
  id: 'session-1',
  name: 'Maya',
  neighbourhood: 'soho',
  chapter: 'bignight',
  bag: 'brooklyn',
  street_prompt: 'A glowing Coach street in Soho',
  anchor_url: '/neigh/soho-bignight.png',
  step: 'street',
  look_index: 0,
  saved_looks: [],
  selfie_url: null,
  line: "Tonight I'm not asking permission.",
  film_status: 'none',
  film_url: null,
  shared: false,
  cta: null,
  walk_ms: 0,
  store_ms: 0,
  created_at: 0,
}

async function reachStreet(name = 'Maya') {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: "Tap to enter Coach's London" }))
  await user.click(await screen.findByRole('button', { name: 'Soho' }))
  await user.click(screen.getByRole('button', { name: 'Big night' }))
  await user.click(screen.getByRole('button', { name: 'Brooklyn' }))
  await user.type(screen.getByLabelText('First name (optional)'), name)
  await user.click(screen.getByRole('button', { name: 'Continue to your London' }))
  expect(await screen.findByRole('heading', { name: 'Big night. Coach & you.' })).toBeInTheDocument()
  return user
}

async function reachPortal() {
  const user = await reachStreet()
  await user.click(screen.getByRole('button', { name: 'Enter Coach' }))
  return { user, portal: await screen.findByLabelText('Find Your Courage portal') }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const streetHandle = {
  move: mocks.move,
  strafe: mocks.strafe,
  look: mocks.look,
  steer: mocks.steer,
  close: mocks.close,
}

describe('Play', () => {
  afterEach(() => vi.useRealTimers())

  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    mocks.createSession.mockResolvedValue({ id: 'session-1' })
    mocks.getImmersiveWorld.mockResolvedValue({ world_id: null })
    mocks.reactorToken
      .mockResolvedValueOnce({ jwt: 'street-jwt' })
      .mockResolvedValue({ jwt: 'immersive-jwt' })
    mocks.sendAnswers.mockResolvedValue(session)
    mocks.sendEvent.mockResolvedValue({ ok: true })
    mocks.openWorld.mockResolvedValue(streetHandle)
    mocks.close.mockResolvedValue(undefined)
  })

  it('uses the exact configured Coach black on branded entry and question surfaces', async () => {
    const user = userEvent.setup()
    render(<Play />)

    expect(screen.getByRole('main')).toHaveStyle({ backgroundColor: COACH.black })
    await user.click(screen.getByRole('button', { name: "Tap to enter Coach's London" }))
    expect(await screen.findByRole('heading', { name: "Where's your London?" })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveStyle({ backgroundColor: COACH.black })
  })

  it('keeps the questions and street, then shuts down LingBot alongside the muted portal', async () => {
    render(<Play />)
    const { portal } = await reachPortal()

    expect(mocks.sendAnswers).toHaveBeenCalledWith({
      id: 'session-1',
      name: 'Maya',
      neighbourhood: 'soho',
      chapter: 'bignight',
      bag: 'brooklyn',
    })
    expect(mocks.sendEvent).toHaveBeenCalledWith('session-1', 'street_enter')
    expect(mocks.close).toHaveBeenCalledOnce()
    expect(portal).toHaveAttribute('src', '/immersive/portal.mp4')
    expect(portal).toHaveAttribute('controls')
    expect(portal).toHaveAttribute('autoplay')
    expect((portal as HTMLVideoElement).muted).toBe(true)
    expect(mocks.reactorToken).toHaveBeenCalledTimes(2)
  })

  it.each([false, true])('shows the portal during a pending open and waits for one close (StrictMode: %s)', async (strict) => {
    const opening = deferred<typeof streetHandle>()
    const closing = deferred<void>()
    mocks.openWorld.mockReturnValue(opening.promise)
    mocks.close.mockReturnValue(closing.promise)
    const { unmount } = render(strict ? <StrictMode><Play /></StrictMode> : <Play />)
    const { portal } = await reachPortal()

    expect(mocks.openWorld).toHaveBeenCalledOnce()
    expect(mocks.close).not.toHaveBeenCalled()
    expect(mocks.reactorToken).toHaveBeenCalledTimes(strict ? 3 : 2)
    fireEvent.ended(portal)
    expect(screen.queryByTestId('immersive-world')).not.toBeInTheDocument()

    await act(async () => opening.resolve(streetHandle))
    expect(mocks.close).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Find Your Courage portal')).toBe(portal)
    expect(screen.queryByTestId('immersive-world')).not.toBeInTheDocument()

    await act(async () => closing.resolve())
    expect(screen.getByTestId('immersive-world')).toHaveAttribute('data-jwt', 'immersive-jwt')
    unmount()
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it.each(['open', 'close', 'token'] as const)('offers exact products after a pending %s times out without bypassing cleanup on retry', async (pending) => {
    const opening = deferred<typeof streetHandle>()
    const closing = deferred<void>()
    const token = deferred<{ jwt: string }>()
    if (pending === 'open') mocks.openWorld.mockReturnValue(opening.promise)
    if (pending === 'close') mocks.close.mockReturnValue(closing.promise)
    render(<Play />)
    await reachStreet()
    if (pending === 'token') mocks.reactorToken.mockReturnValue(token.promise)
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Enter Coach' }))
    const portal = screen.getByLabelText('Find Your Courage portal')
    fireEvent.ended(portal)
    await act(async () => { await vi.advanceTimersByTimeAsync(7_999) })
    expect(screen.queryByTestId('immersive-world')).not.toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })

    expect(screen.getByTestId('immersive-world')).toHaveAttribute('data-jwt', 'fallback')
    fireEvent.click(screen.getByRole('button', { name: 'Explore Tabby' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close product view' }))
    if (pending !== 'token') {
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry live garden' })))
      expect(mocks.retryResult).toHaveBeenLastCalledWith(null)
      expect(mocks.reactorToken).toHaveBeenCalledTimes(2)
    }
    await act(async () => {
      opening.resolve(streetHandle)
      closing.resolve()
      token.resolve({ jwt: 'late-jwt' })
    })
    expect(screen.getByTestId('immersive-world')).toHaveAttribute('data-jwt', 'fallback')
    expect(mocks.close).toHaveBeenCalledOnce()
    mocks.reactorToken.mockResolvedValue({ jwt: 'retry-jwt' })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry live garden' })))
    expect(mocks.retryResult).toHaveBeenLastCalledWith('retry-jwt')
    fireEvent.click(screen.getByRole('button', { name: 'Explore Tabby' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it.each(['open', 'close'] as const)('keeps live entry and retry blocked when %s cleanup fails', async (failure) => {
    if (failure === 'open') mocks.openWorld.mockRejectedValue(new WorldCleanupError('disconnect failed'))
    else mocks.close.mockRejectedValue(new Error('disconnect failed'))
    render(<Play />)
    const user = await reachStreet()
    if (failure === 'open') {
      await user.click(await screen.findByRole('button', { name: 'Retry live street' }))
      expect(mocks.openWorld).toHaveBeenCalledOnce()
    }
    await user.click(screen.getByRole('button', { name: 'Enter Coach' }))
    fireEvent.ended(await screen.findByLabelText('Find Your Courage portal'))
    expect(await screen.findByTestId('immersive-world')).toHaveAttribute('data-jwt', 'fallback')
    await user.click(screen.getByRole('button', { name: 'Retry live garden' }))
    expect(mocks.retryResult).toHaveBeenLastCalledWith(null)
    expect(mocks.reactorToken).toHaveBeenCalledTimes(2)
    expect(mocks.openWorld).toHaveBeenCalledOnce()
    expect(mocks.close).toHaveBeenCalledTimes(failure === 'open' ? 0 : 1)
  })

  it('closes a late street instance once after unmount without advancing the portal', async () => {
    const opening = deferred<typeof streetHandle>()
    mocks.openWorld.mockReturnValue(opening.promise)
    const { unmount } = render(<Play />)
    const { portal } = await reachPortal()
    fireEvent.ended(portal)
    unmount()
    await act(async () => opening.resolve(streetHandle))
    expect(mocks.close).toHaveBeenCalledOnce()
    expect(mocks.sendEvent.mock.calls.filter(([, type]) => type === 'immersive_enter')).toHaveLength(0)
  })

  it('closes a pending street open once when unmounted without entering the store', async () => {
    const opening = deferred<typeof streetHandle>()
    mocks.openWorld.mockReturnValue(opening.promise)
    const { unmount } = render(<Play />)
    await reachStreet()
    expect(mocks.openWorld).toHaveBeenCalledOnce()
    unmount()
    await act(async () => opening.resolve(streetHandle))
    expect(mocks.close).toHaveBeenCalledOnce()
    expect(mocks.reactorToken).toHaveBeenCalledOnce()
    expect(mocks.sendEvent.mock.calls.filter(([, type]) => type === 'store_enter')).toHaveLength(0)
  })

  it('does not open a late-token street after the portal is already mounted', async () => {
    const token = deferred<{ jwt: string }>()
    mocks.reactorToken.mockReset()
    mocks.reactorToken.mockReturnValueOnce(token.promise).mockResolvedValue({ jwt: 'immersive-jwt' })
    render(<Play />)
    const { portal } = await reachPortal()
    expect(mocks.openWorld).not.toHaveBeenCalled()
    await act(async () => token.resolve({ jwt: 'late-street-jwt' }))
    fireEvent.ended(portal)
    expect(await screen.findByTestId('immersive-world')).toHaveAttribute('data-jwt', 'immersive-jwt')
    expect(mocks.openWorld).not.toHaveBeenCalled()
    expect(mocks.close).not.toHaveBeenCalled()
    expect(mocks.reactorToken).toHaveBeenCalledTimes(2)
  })

  it('allows a street retry after an opening error whose cleanup succeeded', async () => {
    mocks.openWorld.mockRejectedValueOnce(new Error('connect failed'))
    render(<Play />)
    const user = await reachStreet()
    await user.click(await screen.findByRole('button', { name: 'Retry live street' }))
    await waitFor(() => expect(mocks.openWorld).toHaveBeenCalledTimes(2))
    await user.click(screen.getByRole('button', { name: 'Enter Coach' }))
    fireEvent.ended(await screen.findByLabelText('Find Your Courage portal'))
    expect(await screen.findByTestId('immersive-world')).toHaveAttribute('data-jwt', 'immersive-jwt')
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('enters the immersive world from the exact portal and completes with the selected bag', async () => {
    render(<Play />)
    const { user, portal } = await reachPortal()

    await waitFor(() => expect(mocks.reactorToken).toHaveBeenCalledTimes(2))
    fireEvent.ended(portal)

    const world = await screen.findByTestId('immersive-world')
    expect(world).toHaveAttribute('data-jwt', 'immersive-jwt')
    expect(mocks.sendEvent.mock.calls.filter(([, type]) => type === 'immersive_enter')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Explore Brooklyn' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Brooklyn' })).toBeInTheDocument()
    expect(screen.getByTestId('immersive-world')).toBeInTheDocument()
    expect(mocks.sendEvent).toHaveBeenCalledWith('session-1', 'product_view', 'brooklyn')

    await user.click(screen.getByRole('button', { name: 'Choose Brooklyn' }))
    expect(screen.getByRole('heading', { name: 'Carry your courage.' })).toBeInTheDocument()
    expect(screen.getByText('Maya chose the Coach Brooklyn.')).toBeInTheDocument()
    expect(mocks.sendEvent).toHaveBeenCalledWith('session-1', 'product_select', 'brooklyn')
    expect(mocks.sendEvent).toHaveBeenCalledWith('session-1', 'world_time', expect.any(Number))
    expect(mocks.uploadSelfie).not.toHaveBeenCalled()
    expect(mocks.startFilm).not.toHaveBeenCalled()
  })

  it('returns from the inspector to the same live world', async () => {
    render(<Play />)
    const { user, portal } = await reachPortal()
    fireEvent.ended(portal)
    const world = await screen.findByTestId('immersive-world')

    await user.click(screen.getByRole('button', { name: 'Explore Tabby' }))
    await user.click(screen.getByRole('button', { name: 'Close product view' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('immersive-world')).toBe(world)
  })

  it('emits one drop when a started experience is hidden and removes the listener on unmount', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Play />)
    await user.click(screen.getByRole('button', { name: "Tap to enter Coach's London" }))
    await screen.findByRole('heading', { name: "Where's your London?" })

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(mocks.sendEvent).toHaveBeenCalledWith('session-1', 'drop'))

    unmount()
    document.dispatchEvent(new Event('visibilitychange'))
    expect(mocks.sendEvent.mock.calls.filter(([, type]) => type === 'drop')).toHaveLength(1)
  })
})
