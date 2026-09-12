import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COACH } from '../data/config'
import type { Session } from '../lib/api'
import type { WorldHandle } from '../lib/world'
import Play, { FilmStage } from './Play'

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  reactorToken: vi.fn(),
  sendAnswers: vi.fn(),
  sendEvent: vi.fn(),
  startFilm: vi.fn(),
  getSession: vi.fn(),
  openWorld: vi.fn(),
  move: vi.fn(),
  strafe: vi.fn(),
  look: vi.fn(),
  steer: vi.fn(),
  close: vi.fn(),
  requestPermission: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  api: {
    createSession: mocks.createSession,
    reactorToken: mocks.reactorToken,
    sendAnswers: mocks.sendAnswers,
    sendEvent: mocks.sendEvent,
    startFilm: mocks.startFilm,
    getSession: mocks.getSession,
  },
}))

vi.mock('../lib/world', () => ({ openWorld: mocks.openWorld }))

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
  expect(await screen.findByRole('heading', { name: "Where's your London?" })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Soho' }))
  expect(screen.getByRole('heading', { name: "What's the next chapter?" })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Big night' }))
  expect(screen.getByRole('heading', { name: 'Pick your companion' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Brooklyn' }))
  expect(screen.getByRole('heading', { name: 'And you are?' })).toBeInTheDocument()
  await user.type(screen.getByLabelText('First name (optional)'), name)
  await user.click(screen.getByRole('button', { name: 'Continue to your London' }))
  expect(await screen.findByRole('heading', { name: 'Big night. Coach & you.' })).toBeInTheDocument()
  return user
}

describe('Smooth demo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/play?demo=1')
  })

  afterEach(() => {
    window.history.replaceState({}, '', '/play')
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('completes the Soho demo without any backend or Reactor requests', async () => {
    const user = userEvent.setup()
    render(<Play />)
    await user.click(screen.getByRole('button', { name: 'Start smooth Soho demo' }))
    expect(screen.getByText('Smooth demo · local scene')).toBeInTheDocument()
    expect(screen.getByAltText('Soho at night')).toHaveAttribute('src', '/neigh/soho-bignight.png')
    await user.click(screen.getByRole('button', { name: 'Enter Coach' }))
    expect(screen.getByRole('heading', { name: 'Your Soho chapter.' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Walk again' }))
    expect(screen.getByRole('button', { name: 'Hold to walk' })).toBeInTheDocument()
    expect(mocks.createSession).not.toHaveBeenCalled()
    expect(mocks.reactorToken).not.toHaveBeenCalled()
    expect(mocks.openWorld).not.toHaveBeenCalled()
    expect(mocks.sendEvent).not.toHaveBeenCalled()
  })

  it('smooths tilt locally, zooms only while held, and stops on release or blur', async () => {
    vi.useFakeTimers()
    render(<Play />)
    fireEvent.click(screen.getByRole('button', { name: 'Start smooth Soho demo' }))
    const scene = screen.getByTestId('demo-scene')
    const walk = screen.getByRole('button', { name: 'Hold to walk' })
    const tilt = (gamma: number) => {
      const event = new Event('deviceorientation')
      Object.defineProperty(event, 'gamma', { value: gamma })
      fireEvent(window, event)
    }
    tilt(10)
    tilt(30)
    await act(async () => vi.advanceTimersByTimeAsync(100))
    const pan = Number(scene.style.transform.match(/translate3d\(([-\d.]+)px/)?.[1])
    const zoom = () => Number(scene.style.transform.match(/scale\(([\d.]+)\)/)?.[1])
    expect(pan).toBeLessThan(0)
    expect(pan).toBeGreaterThan(-55)
    expect(zoom()).toBe(1.18)
    fireEvent.pointerDown(walk, { pointerId: 1 })
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect(zoom()).toBeGreaterThan(1.2)
    expect(zoom()).toBeLessThan(1.23)
    fireEvent.pointerUp(walk, { pointerId: 1 })
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    const stopped = scene.style.transform
    await act(async () => vi.advanceTimersByTimeAsync(500))
    expect(scene.style.transform).toBe(stopped)
    fireEvent.pointerDown(walk, { pointerId: 2 })
    fireEvent.blur(window)
    await act(async () => vi.advanceTimersByTimeAsync(500))
    expect(scene.style.transform).toBe(stopped)
  })
})

describe('Play', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.createSession.mockResolvedValue({ id: 'session-1' })
    mocks.reactorToken.mockResolvedValue({ jwt: 'jwt-1' })
    mocks.sendAnswers.mockResolvedValue(session)
    mocks.sendEvent.mockResolvedValue({ ok: true })
    mocks.startFilm.mockResolvedValue({ film_status: 'pending' })
    mocks.getSession.mockResolvedValue({ ...session, film_status: 'pending' })
    mocks.openWorld.mockResolvedValue({
      move: mocks.move,
      strafe: mocks.strafe,
      look: mocks.look,
      steer: mocks.steer,
      close: mocks.close,
    })
    mocks.close.mockResolvedValue(undefined)
    mocks.requestPermission.mockResolvedValue('granted')
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: class extends Event {
        static requestPermission = mocks.requestPermission
      },
    })
  })

  it('uses the exact configured Coach black on branded stage surfaces', async () => {
    const user = userEvent.setup()
    render(<Play />)

    expect(screen.getByRole('main')).toHaveStyle({ backgroundColor: COACH.black })
    await user.click(screen.getByRole('button', { name: "Tap to enter Coach's London" }))
    expect(await screen.findByRole('heading', { name: "Where's your London?" })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveStyle({ backgroundColor: COACH.black })
  })

  it('starts the session and token prefetch from the entry gesture', async () => {
    const user = userEvent.setup()
    render(<Play />)

    await user.click(screen.getByRole('button', { name: "Tap to enter Coach's London" }))

    expect(mocks.requestPermission).toHaveBeenCalledOnce()
    expect(mocks.createSession).toHaveBeenCalledOnce()
    expect(mocks.reactorToken).toHaveBeenCalledOnce()
    expect(await screen.findByRole('heading', { name: "Where's your London?" })).toBeInTheDocument()
  })

  it('asks neighbourhood, chapter, bag, and optional name in order before submitting answers', async () => {
    render(<Play />)

    await reachStreet()

    expect(mocks.sendAnswers).toHaveBeenCalledWith({
      id: 'session-1',
      name: 'Maya',
      neighbourhood: 'soho',
      chapter: 'bignight',
      bag: 'brooklyn',
    })
    expect(mocks.sendEvent).toHaveBeenCalledWith('session-1', 'street_enter')
    await waitFor(() => expect(mocks.openWorld).toHaveBeenCalledOnce())
  })

  it('uses the branded still and parallax street when the Reactor kill switch is set', async () => {
    localStorage.setItem('coach_no_reactor', '1')
    render(<Play />)

    await reachStreet()

    expect(screen.getByTestId('street-fallback')).toHaveTextContent('Exploring Soho')
    expect(screen.getByText('Still mode')).toBeInTheDocument()
    expect(mocks.openWorld).not.toHaveBeenCalled()
  })

  it('turns immediately and stops on neutral without replaying a stale tilt', async () => {
    render(<Play />)
    await reachStreet()
    vi.useFakeTimers()
    try {
      const tilt = (gamma: number) => {
        const event = new Event('deviceorientation')
        Object.defineProperty(event, 'gamma', { value: gamma })
        fireEvent(window, event)
      }

      tilt(0)
      mocks.look.mockClear()
      tilt(20)
      expect(mocks.look).toHaveBeenLastCalledWith('right')
      tilt(21)
      expect(mocks.look).toHaveBeenCalledTimes(1)
      tilt(0)
      expect(mocks.look).toHaveBeenLastCalledWith('idle')
      tilt(-20)
      expect(mocks.look).toHaveBeenLastCalledWith('left')
      tilt(0)
      await act(async () => vi.advanceTimersByTimeAsync(350))
      expect(mocks.look.mock.calls).toEqual([['right'], ['idle'], ['left'], ['idle']])
    } finally {
      vi.useRealTimers()
    }
  })

  it('calibrates the live tilt and does not chatter around the turn threshold', async () => {
    render(<Play />)
    await reachStreet()
    const tilt = (gamma: number) => {
      const event = new Event('deviceorientation')
      Object.defineProperty(event, 'gamma', { value: gamma })
      fireEvent(window, event)
    }

    tilt(15)
    expect(mocks.look).not.toHaveBeenCalledWith('right')
    mocks.look.mockClear()
    for (const gamma of [35, 24, 22, 25, 23, 15, -5, 6, 8, 5, 7, 15]) tilt(gamma)
    expect(mocks.look.mock.calls).toEqual([['right'], ['idle'], ['left'], ['idle']])
    tilt(35)
    fireEvent.click(screen.getByRole('button', { name: 'Recenter tilt' }))
    expect(mocks.look).toHaveBeenLastCalledWith('idle')
    tilt(35)
    expect(mocks.look).toHaveBeenLastCalledWith('idle')
  })

  it.each([false, true])('keeps the latest held controls during connection (released: %s)', async (released) => {
    let connected!: (world: WorldHandle) => void
    mocks.openWorld.mockImplementationOnce(() => new Promise<WorldHandle>((resolve) => { connected = resolve }))
    render(<Play />)
    await reachStreet()
    const tilt = (gamma: number) => {
      const event = new Event('deviceorientation')
      Object.defineProperty(event, 'gamma', { value: gamma })
      fireEvent(window, event)
    }
    tilt(0)
    tilt(20)
    const walk = screen.getByRole('button', { name: 'Hold to walk' })
    Object.defineProperty(walk, 'setPointerCapture', { value: vi.fn() })
    fireEvent.pointerDown(walk, { pointerId: 1 })
    if (released) {
      fireEvent.pointerUp(walk, { pointerId: 1 })
      tilt(0)
    }
    await act(async () => connected({ move: mocks.move, look: mocks.look, strafe: mocks.strafe, steer: mocks.steer, close: mocks.close }))
    if (released) {
      expect(mocks.move).not.toHaveBeenCalledWith('forward')
      expect(mocks.look).not.toHaveBeenCalledWith('right')
    } else {
      expect(mocks.move).toHaveBeenLastCalledWith('forward')
      expect(mocks.look).toHaveBeenLastCalledWith('right')
      fireEvent.blur(window)
      expect(mocks.move).toHaveBeenLastCalledWith('idle')
      expect(mocks.look).toHaveBeenLastCalledWith('idle')
    }
  })

  it('enters the explicit mirror stage from the street', async () => {
    localStorage.setItem('coach_no_reactor', '1')
    render(<Play />)
    const user = await reachStreet()

    await user.click(screen.getByRole('button', { name: 'Enter Coach' }))

    expect(mocks.sendEvent).toHaveBeenCalledWith('session-1', 'store_enter')
    expect(screen.getByTestId('mirror-stage')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Step in front of the mirror' }))
    await user.click(screen.getByRole('button', { name: 'Continue to your chapter' }))
    expect(screen.getByTestId('film-stage')).toBeInTheDocument()
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

describe('FilmStage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendEvent.mockResolvedValue({ ok: true })
    mocks.startFilm.mockResolvedValue({ film_status: 'pending' })
    mocks.getSession.mockResolvedValue({ ...session, film_status: 'pending' })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    Reflect.deleteProperty(window.navigator, 'share')
  })

  it('offers exactly three chapter-safe lines with the configured default selected first', () => {
    render(<FilmStage session={session} />)

    const choices = screen.getAllByRole('button', { name: /^Choose line:/ })
    expect(choices).toHaveLength(3)
    expect(choices[0]).toHaveTextContent("Tonight I'm not asking permission.")
    expect(choices[0]).toHaveAttribute('aria-pressed', 'true')
  })

  it('accepts a custom line and sends it before requesting the film', async () => {
    const user = userEvent.setup()
    render(<FilmStage session={session} />)

    await user.click(screen.getByRole('button', { name: 'Write your own line' }))
    await user.type(screen.getByLabelText('Your chapter line'), 'London, meet the real me.')
    await user.click(screen.getByRole('button', { name: 'Make my film' }))

    expect(mocks.sendEvent).toHaveBeenCalledWith('session-1', 'line', 'London, meet the real me.')
    expect(mocks.startFilm).toHaveBeenCalledWith('session-1')
    expect(mocks.sendEvent.mock.invocationCallOrder[0]).toBeLessThan(mocks.startFilm.mock.invocationCallOrder[0])
    expect(screen.getByText('Cutting your chapter…')).toBeInTheDocument()
  })

  it('polls every two seconds until the returned film is ready and plays that URL', async () => {
    vi.useFakeTimers()
    mocks.getSession.mockResolvedValueOnce({ ...session, film_status: 'ready', film_url: '/api/files/films/session-1.mp4' })
    render(<FilmStage session={session} />)

    fireEvent.click(screen.getAllByRole('button', { name: /^Choose line:/ })[1])
    fireEvent.click(screen.getByRole('button', { name: 'Make my film' }))
    await act(async () => undefined)
    expect(mocks.sendEvent).toHaveBeenCalledWith('session-1', 'line', 'The night starts when I arrive.')
    expect(screen.getByText('Cutting your chapter…')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })

    expect(mocks.getSession).toHaveBeenCalledWith('session-1')
    expect(screen.getByTestId('chapter-film')).toHaveAttribute('src', '/api/files/films/session-1.mp4')
  })

  it('autoplays the phone film muted and restarts it with sound in the hear gesture', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<FilmStage session={{ ...session, film_status: 'ready', film_url: '/chapter.mp4' }} />)

    const film = screen.getByTestId('chapter-film') as HTMLVideoElement
    expect(film).toHaveProperty('autoplay', true)
    expect(film).toHaveProperty('muted', true)
    const hear = screen.getByRole('button', { name: 'Hear my chapter' })
    expect(hear).toHaveClass('min-h-14')

    film.currentTime = 5
    await user.click(hear)

    expect(film.currentTime).toBe(0)
    expect(film.muted).toBe(false)
    expect(play).toHaveBeenCalledOnce()
  })

  it('cleans up the pending poll when the film stage unmounts', async () => {
    vi.useFakeTimers()
    const { unmount } = render(<FilmStage session={{ ...session, film_status: 'pending' }} />)

    unmount()
    await vi.advanceTimersByTimeAsync(2_000)

    expect(mocks.getSession).not.toHaveBeenCalled()
  })

  it('stops a failed film from hanging and offers a graceful retry', async () => {
    vi.useFakeTimers()
    mocks.getSession.mockResolvedValueOnce({ ...session, film_status: 'failed', film_url: null })
    render(<FilmStage session={session} />)

    fireEvent.click(screen.getByRole('button', { name: 'Make my film' }))
    await act(async () => undefined)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })

    expect(screen.getByRole('alert')).toHaveTextContent("Your film couldn't be cut just yet")
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('copies the film URL when Web Share is unavailable and records the share', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<FilmStage session={{ ...session, film_status: 'ready', film_url: 'https://coach.test/maya.mp4' }} />)

    await user.click(screen.getByRole('button', { name: 'Share your chapter' }))

    expect(await screen.findByText('Film link copied.')).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith('https://coach.test/maya.mp4')
    expect(mocks.sendEvent).toHaveBeenCalledWith('session-1', 'share')
  })

  it('uses Web Share with the returned film URL when supported', async () => {
    const user = userEvent.setup()
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'share', { configurable: true, value: share })
    render(<FilmStage session={{ ...session, film_status: 'ready', film_url: 'https://coach.test/maya.mp4' }} />)

    await user.click(screen.getByRole('button', { name: 'Share your chapter' }))

    expect(await screen.findByText('Chapter shared.')).toBeInTheDocument()
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://coach.test/maya.mp4' }))
    expect(mocks.sendEvent).toHaveBeenCalledWith('session-1', 'share')
  })

  it('emits exact CTA values and replaces the actions with branded confirmation', async () => {
    const user = userEvent.setup()
    const readySession = { ...session, film_status: 'ready' as const, film_url: 'https://coach.test/maya.mp4' }
    const { unmount } = render(<FilmStage session={readySession} />)

    await user.click(screen.getByRole('button', { name: 'Reserve the Brooklyn at Coach Regent Street' }))

    expect(mocks.sendEvent).toHaveBeenCalledWith('session-1', 'cta', 'reserve')
    expect(screen.getByRole('heading', { name: 'See you on Regent Street.' })).toBeInTheDocument()
    expect(screen.getByText(/Maya's next chapter/)).toBeInTheDocument()

    unmount()
    render(<FilmStage session={readySession} />)
    await user.click(screen.getByRole('button', { name: 'Send to a friend' }))
    expect(mocks.sendEvent).toHaveBeenCalledWith('session-1', 'cta', 'send')
    expect(screen.getByRole('heading', { name: 'Your chapter is ready to travel.' })).toBeInTheDocument()
  })
})
