import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../lib/api'
import Play from './Play'

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  reactorToken: vi.fn(),
  sendAnswers: vi.fn(),
  sendEvent: vi.fn(),
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

describe('Play', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.createSession.mockResolvedValue({ id: 'session-1' })
    mocks.reactorToken.mockResolvedValue({ jwt: 'jwt-1' })
    mocks.sendAnswers.mockResolvedValue(session)
    mocks.sendEvent.mockResolvedValue({ ok: true })
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

  it('enters the explicit mirror stage from the street', async () => {
    localStorage.setItem('coach_no_reactor', '1')
    render(<Play />)
    const user = await reachStreet()

    await user.click(screen.getByRole('button', { name: 'Enter Coach' }))

    expect(mocks.sendEvent).toHaveBeenCalledWith('session-1', 'store_enter')
    expect(screen.getByTestId('mirror-stage')).toBeInTheDocument()
  })
})
