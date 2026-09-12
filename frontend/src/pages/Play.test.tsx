import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { COACH } from '../data/config'
import type { Session } from '../lib/api'
import Play from './Play'

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
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
}))

vi.mock('../lib/api', () => ({
  api: {
    createSession: mocks.createSession,
    reactorToken: mocks.reactorToken,
    sendAnswers: mocks.sendAnswers,
    sendEvent: mocks.sendEvent,
    uploadSelfie: mocks.uploadSelfie,
    startFilm: mocks.startFilm,
  },
}))

vi.mock('../lib/world', () => ({ openWorld: mocks.openWorld }))

vi.mock('../components/ImmersiveWorld', () => ({
  default: ({ jwt, onViewProduct }: { jwt: string | null; onViewProduct: (product: 'tabby' | 'brooklyn') => void }) => (
    <section data-testid="immersive-world" data-jwt={jwt ?? 'fallback'}>
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

describe('Play', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.createSession.mockResolvedValue({ id: 'session-1' })
    mocks.reactorToken
      .mockResolvedValueOnce({ jwt: 'street-jwt' })
      .mockResolvedValue({ jwt: 'immersive-jwt' })
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
  })

  it('uses the exact configured Coach black on branded entry and question surfaces', async () => {
    const user = userEvent.setup()
    render(<Play />)

    expect(screen.getByRole('main')).toHaveStyle({ backgroundColor: COACH.black })
    await user.click(screen.getByRole('button', { name: "Tap to enter Coach's London" }))
    expect(await screen.findByRole('heading', { name: "Where's your London?" })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveStyle({ backgroundColor: COACH.black })
  })

  it('keeps the questions and street, then closes LingBot before mounting the portal', async () => {
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
    expect(mocks.close.mock.invocationCallOrder[0]).toBeLessThan(mocks.reactorToken.mock.invocationCallOrder[1])
    expect(portal).toHaveAttribute('src', '/immersive/portal.mp4')
    expect(portal).toHaveAttribute('controls')
    expect(mocks.reactorToken).toHaveBeenCalledTimes(2)
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
