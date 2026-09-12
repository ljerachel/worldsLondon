import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NEIGHBOURHOODS } from '../data/config'
import type { Session } from '../lib/api'
import Dash from './Dash'

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  insight: vi.fn(),
  localise: vi.fn(),
  seed: vi.fn(),
  reset: vi.fn(),
  confirm: vi.fn(),
  requestFullscreen: vi.fn(),
  exitFullscreen: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  api: {
    getState: mocks.getState,
    insight: mocks.insight,
    localise: mocks.localise,
    seed: mocks.seed,
    reset: mocks.reset,
  },
}))

const maya: Session = {
  id: 'maya-1',
  name: 'Maya',
  neighbourhood: 'soho',
  chapter: 'bignight',
  bag: 'brooklyn',
  street_prompt: 'Soho after dark',
  anchor_url: '/neigh/soho-bignight.png',
  step: 'film',
  look_index: 1,
  saved_looks: [1],
  selfie_url: '/api/files/selfies/maya.jpg',
  line: "Tonight I'm not asking permission.",
  film_status: 'ready',
  film_url: '/api/files/films/maya.mp4',
  shared: true,
  cta: 'reserve',
  walk_ms: 4000,
  store_ms: 8000,
  created_at: 1,
}

const guest: Session = {
  ...maya,
  id: 'guest-2',
  name: '',
  neighbourhood: 'peckham',
  chapter: 'sunday',
  bag: 'tabby',
  selfie_url: null,
  film_status: 'none',
  film_url: null,
  shared: false,
  cta: null,
  created_at: 2,
}

const counts = {
  scans: 41,
  walking: 7,
  in_store: 5,
  tryons: 13,
  saves: 9,
  films: 6,
  shares: 4,
  reservations: 2,
}

const strategy = {
  headline: 'Big nights belong to Soho',
  reasoning: ['Soho leads evening visits', 'Brooklyn earns the most saves', 'Film sharing peaks after store time', 'OOH should meet the night audience'],
  segments: [{ label: 'Night explorers', share: 62 }, { label: 'Quiet creatives', share: 38 }],
  media_plan: ['Soho station takeovers', 'Run from 6pm', 'Lead with Brooklyn stories'],
  localise: ['soho', 'peckham'],
}

async function renderLoaded() {
  render(<Dash />)
  await waitFor(() => expect(mocks.getState).toHaveBeenCalled())
  await screen.findByText('Maya')
}

describe('Dash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mocks.getState.mockResolvedValue({ sessions: [maya, guest], counts })
    mocks.localise.mockResolvedValue({
      posters: [
        { neighbourhood: 'soho', url: '/api/files/posters/soho.jpg' },
        { neighbourhood: 'peckham', url: '/api/files/posters/peckham.jpg' },
      ],
    })
    mocks.seed.mockResolvedValue({ ok: true })
    mocks.reset.mockResolvedValue({ ok: true })
    mocks.confirm.mockReturnValue(true)
    mocks.requestFullscreen.mockResolvedValue(undefined)
    mocks.exitFullscreen.mockResolvedValue(undefined)
    vi.stubGlobal('confirm', mocks.confirm)
    Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: mocks.requestFullscreen })
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: mocks.exitFullscreen })
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('polls every 1.5 seconds and displays all eight backend counters without recomputing them', async () => {
    vi.useFakeTimers()
    render(<Dash />)
    await act(async () => {})

    expect(mocks.getState).toHaveBeenCalledTimes(1)
    for (const [label, value] of [
      ['Scans', 41], ['Walking', 7], ['In store', 5], ['Try-ons', 13],
      ['Saves', 9], ['Chapters made', 6], ['Shares', 4], ['Reservations', 2],
    ] as const) {
      const counter = screen.getByTestId(`counter-${label.toLowerCase().replaceAll(' ', '-').replaceAll('chapters-made', 'chapters-made')}`)
      expect(within(counter).getByText(String(value))).toBeInTheDocument()
    }

    await vi.advanceTimersByTimeAsync(1500)
    expect(mocks.getState).toHaveBeenCalledTimes(2)
  })

  it('draws and labels all six configured neighbourhoods and gives every visitor a map pulse', async () => {
    await renderLoaded()

    const map = screen.getByRole('img', { name: 'Live map of Coach visitors across London' })
    for (const neighbourhood of Object.values(NEIGHBOURHOODS)) {
      expect(within(map).getByText(neighbourhood.label)).toBeInTheDocument()
    }
    expect(within(map).getAllByTestId('visitor-pulse')).toHaveLength(2)
  })

  it('renders the visitor list and look wall fallback, then opens a playable film modal', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    expect(screen.getByText('Big night · Brooklyn')).toBeInTheDocument()
    expect(screen.getByText('Quiet Sunday · Tabby')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: "Maya's Coach look" })).toHaveAttribute('src', maya.selfie_url)
    expect(screen.getByRole('img', { name: "Guest's Coach look" })).toHaveAttribute('src', '/looks/tabby-2.png')

    await user.click(screen.getByRole('button', { name: "Play Maya's chapter film" }))
    expect(screen.getByRole('dialog', { name: "Maya's chapter" })).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-film')).toHaveAttribute('src', maya.film_url)
    expect(screen.getByTestId('dashboard-film')).toHaveAttribute('controls')
    await user.click(screen.getByRole('button', { name: 'Close film' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('types deterministic local reasoning every 700ms, never requests insight, and generates valid localised posters', async () => {
    vi.useFakeTimers()
    render(<Dash />)
    await act(async () => {})

    fireEvent.keyDown(window, { key: 'i' })
    await act(async () => {})
    expect(mocks.insight).not.toHaveBeenCalled()
    expect(screen.getByText(strategy.reasoning[0])).toBeInTheDocument()
    expect(screen.queryByText(strategy.reasoning[1])).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(700))
    expect(screen.getByText(strategy.reasoning[1])).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1400))
    expect(screen.getByRole('heading', { name: strategy.headline })).toBeInTheDocument()
    expect(screen.getByText('Night explorers')).toBeInTheDocument()
    expect(screen.getByText('Soho station takeovers')).toBeInTheDocument()
    expect(mocks.insight).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Generate localised posters' }))
    })
    expect(mocks.localise).toHaveBeenCalledWith(['soho', 'peckham'], 'brooklyn', 'bignight')
    expect(screen.getByRole('heading', { name: 'Ready to ship' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Soho localised Coach poster' })).toBeInTheDocument()
  })

  it('survives state and localisation failures visibly without crashing', async () => {
    mocks.getState.mockRejectedValueOnce(new Error('offline'))
    mocks.localise.mockRejectedValueOnce(new Error('reactor unavailable'))
    render(<Dash />)

    expect(await screen.findByText('Live data unavailable — reconnecting…')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'i' })
    expect(mocks.insight).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Generate localised posters' }))
    expect(await screen.findByText('Poster generation failed — please try again.')).toBeInTheDocument()
  })

  it('supports seed, confirmed reset, insight, and fullscreen hotkeys and removes the listener', async () => {
    const { unmount } = render(<Dash />)
    await act(async () => {})

    fireEvent.keyDown(window, { key: 's' })
    fireEvent.keyDown(window, { key: 'c' })
    fireEvent.keyDown(window, { key: 'f' })
    await waitFor(() => {
      expect(mocks.seed).toHaveBeenCalledWith(20)
      expect(mocks.confirm).toHaveBeenCalled()
      expect(mocks.reset).toHaveBeenCalledOnce()
      expect(mocks.requestFullscreen).toHaveBeenCalledOnce()
    })

    unmount()
    fireEvent.keyDown(window, { key: 's' })
    expect(mocks.seed).toHaveBeenCalledTimes(1)
  })
})
