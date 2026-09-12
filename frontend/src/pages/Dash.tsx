import { useCallback, useEffect, useRef, useState } from 'react'
import { BAGS, CHAPTERS, COACH, NEIGHBOURHOODS } from '../data/config'
import { api } from '../lib/api'
import type { Session } from '../lib/api'

type Counts = Awaited<ReturnType<typeof api.getState>>['counts']
type Poster = { neighbourhood: string; url: string }

const EMPTY_COUNTS: Counts = {
  scans: 0,
  walking: 0,
  in_store: 0,
  tryons: 0,
  saves: 0,
  films: 0,
  shares: 0,
  reservations: 0,
}

const COUNTERS: { key: keyof Counts; label: string; testId: string }[] = [
  { key: 'scans', label: 'Scans', testId: 'scans' },
  { key: 'walking', label: 'Walking', testId: 'walking' },
  { key: 'in_store', label: 'In store', testId: 'in-store' },
  { key: 'tryons', label: 'Try-ons', testId: 'try-ons' },
  { key: 'saves', label: 'Saves', testId: 'saves' },
  { key: 'films', label: 'Chapters made', testId: 'chapters-made' },
  { key: 'shares', label: 'Shares', testId: 'shares' },
  { key: 'reservations', label: 'Reservations', testId: 'reservations' },
]

const STRATEGY = {
  headline: 'Big nights belong to Soho',
  reasoning: [
    'Soho leads evening visits',
    'Brooklyn earns the most saves',
    'Film sharing peaks after store time',
    'OOH should meet the night audience',
  ],
  segments: [
    { label: 'Night explorers', share: 62 },
    { label: 'Quiet creatives', share: 38 },
  ],
  mediaPlan: ['Soho station takeovers', 'Run from 6pm', 'Lead with Brooklyn stories'],
  localise: ['soho', 'peckham'],
  bag: 'brooklyn',
  chapter: 'bignight',
} as const

const BAG_COLOURS: Record<string, string> = {
  tabby: COACH.tan,
  brooklyn: COACH.red,
  empire: COACH.cream,
}

function neighbourhoodName(key: string) {
  return key in NEIGHBOURHOODS
    ? NEIGHBOURHOODS[key as keyof typeof NEIGHBOURHOODS].label
    : key
}

function chapterName(key: string) {
  return key in CHAPTERS ? CHAPTERS[key as keyof typeof CHAPTERS].label : key
}

function bagName(key: string) {
  return key in BAGS ? BAGS[key as keyof typeof BAGS] : key
}

function point(lat: number, lng: number) {
  return {
    x: 34 + ((lng + 0.21) / 0.155) * 532,
    y: 36 + ((51.545 - lat) / 0.08) * 298,
  }
}

export default function Dash() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [stateError, setStateError] = useState(false)
  const [selectedFilm, setSelectedFilm] = useState<Session | null>(null)
  const [insightOpen, setInsightOpen] = useState(false)
  const [visibleSteps, setVisibleSteps] = useState(0)
  const [posters, setPosters] = useState<Poster[]>([])
  const [posterStatus, setPosterStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')
  const reasoningTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const revealInsight = useCallback(() => {
    reasoningTimers.current.forEach(clearTimeout)
    reasoningTimers.current = []
    setInsightOpen(true)
    setVisibleSteps(1)
    setPosters([])
    setPosterStatus('idle')
    reasoningTimers.current = STRATEGY.reasoning.slice(1).map((_, index) =>
      setTimeout(() => setVisibleSteps(index + 2), (index + 1) * 700),
    )
  }, [])

  const refresh = useCallback(async () => {
    try {
      const state = await api.getState()
      setSessions(state.sessions)
      setCounts(state.counts)
      setStateError(false)
    } catch {
      setStateError(true)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(refresh)
    const pollTimer = setInterval(() => void refresh(), 1500)
    return () => clearInterval(pollTimer)
  }, [refresh])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return
      switch (event.key.toLowerCase()) {
        case 's':
          void api.seed(20).then(refresh).catch(() => {})
          break
        case 'c':
          if (window.confirm('Reset every Coach visitor and counter?')) {
            void api.reset().then(refresh).catch(() => {})
          }
          break
        case 'i':
          revealInsight()
          break
        case 'f':
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
          else void document.documentElement.requestFullscreen().catch(() => {})
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [refresh, revealInsight])

  useEffect(() => () => {
    reasoningTimers.current.forEach(clearTimeout)
  }, [])

  const generatePosters = async () => {
    setPosterStatus('loading')
    setPosters([])
    try {
      const result = await api.localise([...STRATEGY.localise], STRATEGY.bag, STRATEGY.chapter)
      setPosters(result.posters)
      setPosterStatus('ready')
    } catch {
      setPosterStatus('failed')
    }
  }

  const planReady = visibleSteps === STRATEGY.reasoning.length

  return (
    <main
      className="min-h-[100dvh] overflow-x-hidden px-4 py-5 sm:px-6 lg:h-[100dvh] lg:overflow-hidden lg:px-8"
      style={{ backgroundColor: COACH.black, color: COACH.cream }}
    >
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b pb-4" style={{ borderColor: COACH.tan }}>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.36em]" style={{ color: COACH.tan }}>Live London signal</p>
          <h1 className="font-serif text-3xl leading-none sm:text-4xl">&amp;Coach — {sessions.length} visitors, {sessions.length} Londons</h1>
        </div>
        <div className="flex gap-4 text-[10px] uppercase tracking-[0.18em]" style={{ color: COACH.tan }}>
          <span>S seed</span><span>C reset</span><span>I insight</span><span>F fullscreen</span>
        </div>
      </header>

      {stateError && (
        <div className="mb-3 border px-3 py-2 text-xs" style={{ borderColor: COACH.red, color: COACH.cream }} role="status">
          Live data unavailable — reconnecting…
        </div>
      )}

      <div className="grid gap-4 lg:h-[calc(100%-17rem)] lg:grid-cols-[minmax(0,1.55fr)_minmax(21rem,0.85fr)]">
        <section className="relative min-h-[22rem] overflow-hidden border" style={{ borderColor: COACH.tan }}>
          <div className="absolute left-4 top-4 z-10">
            <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: COACH.tan }}>Where London is becoming theirs</p>
          </div>
          <svg className="h-full min-h-[22rem] w-full" viewBox="0 0 600 370" role="img" aria-label="Live map of Coach visitors across London">
            <rect width="600" height="370" fill={COACH.black} />
            <path d="M18 260 C105 220 170 285 248 238 S390 204 446 243 S530 272 588 225" fill="none" stroke={COACH.tan} strokeOpacity="0.32" strokeWidth="16" />
            <path d="M18 260 C105 220 170 285 248 238 S390 204 446 243 S530 272 588 225" fill="none" stroke={COACH.cream} strokeOpacity="0.45" strokeWidth="1" />
            <path d="M52 70 L154 46 L260 88 L382 54 L548 110 M82 318 L188 252 L304 324 L424 277 L558 326 M126 28 L136 344 M274 22 L263 347 M441 25 L420 350" fill="none" stroke={COACH.cream} strokeOpacity="0.08" />
            {Object.entries(NEIGHBOURHOODS).map(([key, neighbourhood]) => {
              const position = point(neighbourhood.lat, neighbourhood.lng)
              return (
                <g key={key}>
                  <circle cx={position.x} cy={position.y} r="12" fill={COACH.black} stroke={COACH.tan} strokeWidth="1" />
                  <circle cx={position.x} cy={position.y} r="3" fill={COACH.tan} />
                  <text x={position.x + 15} y={position.y + 4} fill={COACH.cream} fontSize="11" letterSpacing="1.2">{neighbourhood.label}</text>
                </g>
              )
            })}
            {sessions.map((session, index) => {
              const neighbourhood = NEIGHBOURHOODS[session.neighbourhood as keyof typeof NEIGHBOURHOODS]
              const position = neighbourhood ? point(neighbourhood.lat, neighbourhood.lng) : { x: 300, y: 185 }
              const angle = index * 2.4
              return (
                <circle
                  key={session.id}
                  data-testid="visitor-pulse"
                  cx={position.x + Math.cos(angle) * 9}
                  cy={position.y + Math.sin(angle) * 9}
                  r="6"
                  fill={BAG_COLOURS[session.bag] ?? COACH.tan}
                  stroke={COACH.black}
                  strokeWidth="2"
                >
                  <title>{session.name || 'Guest'} in {neighbourhoodName(session.neighbourhood)}</title>
                </circle>
              )
            })}
          </svg>
          <div className="absolute bottom-3 left-4 flex gap-4 text-[9px] uppercase tracking-widest">
            {Object.entries(BAGS).map(([key, label]) => <span key={key}><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: BAG_COLOURS[key] }} />{label}</span>)}
          </div>
        </section>

        <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <section className="grid grid-cols-4 border-l border-t" style={{ borderColor: COACH.tan }} aria-label="Live counters">
            {COUNTERS.map((counter) => (
              <div key={counter.key} data-testid={`counter-${counter.testId}`} className="border-b border-r px-2 py-3" style={{ borderColor: COACH.tan }}>
                <strong className="block font-serif text-2xl leading-none sm:text-3xl" style={{ color: COACH.tan }}>{counts[counter.key]}</strong>
                <span className="mt-1 block text-[8px] uppercase tracking-wider">{counter.label}</span>
              </div>
            ))}
          </section>

          <section className="min-h-0 border p-3" style={{ borderColor: COACH.tan }}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-serif text-xl">London, authored live</h2>
              <span className="text-[9px] uppercase tracking-widest" style={{ color: COACH.tan }}>{sessions.length} active</span>
            </div>
            <ol className="max-h-72 divide-y overflow-y-auto lg:max-h-full" style={{ borderColor: COACH.tan }}>
              {sessions.length === 0 && <li className="py-8 text-center text-xs opacity-60">Waiting for the first London…</li>}
              {sessions.map((session) => (
                <li key={session.id} className="grid grid-cols-[1fr_auto] gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{session.name || 'Guest'}</p>
                    <p className="truncate text-[10px] uppercase tracking-wider" style={{ color: COACH.tan }}>{chapterName(session.chapter)} · {bagName(session.bag)}</p>
                  </div>
                  <div className="text-right text-[9px] uppercase tracking-wider">
                    <p>{neighbourhoodName(session.neighbourhood)}</p>
                    <p className="opacity-50">{session.step.replace('_', ' ')}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <section className="mt-4 lg:h-52" aria-labelledby="look-wall-title">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="look-wall-title" className="font-serif text-xl">The look wall</h2>
          <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color: COACH.tan }}>Every look becomes a chapter</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {sessions.length === 0 && <div className="flex h-36 w-full items-center justify-center border text-xs opacity-60" style={{ borderColor: COACH.tan }}>Looks will appear here live</div>}
          {sessions.map((session) => {
            const name = session.name || 'Guest'
            const image = session.selfie_url || `/looks/${session.bag}-${session.look_index + 1}.png`
            const content = (
              <>
                <img className="h-36 w-28 object-cover" src={image} alt={`${name}'s Coach look`} />
                <span className="absolute inset-x-0 bottom-0 px-2 py-1 text-left text-[9px] uppercase tracking-wider" style={{ backgroundColor: COACH.black }}>{name} · {neighbourhoodName(session.neighbourhood)}</span>
              </>
            )
            return session.film_url ? (
              <button key={session.id} className="relative shrink-0 border text-left" style={{ borderColor: COACH.tan }} aria-label={`Play ${name}'s chapter film`} onClick={() => setSelectedFilm(session)}>{content}</button>
            ) : (
              <div key={session.id} className="relative shrink-0 border" style={{ borderColor: COACH.tan }}>{content}</div>
            )
          })}
        </div>
      </section>

      {insightOpen && (
        <section className="fixed inset-0 z-30 overflow-y-auto p-4 sm:p-8" style={{ backgroundColor: COACH.black, color: COACH.cream }} aria-label="Coach strategy">
          <div className="mx-auto grid min-h-full max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.36em]" style={{ color: COACH.tan }}>Coach strategy · live reasoning</p>
              <ol className="mt-8 space-y-5">
                {STRATEGY.reasoning.slice(0, visibleSteps).map((step, index) => (
                  <li key={step} className="flex gap-4 border-b pb-4" style={{ borderColor: COACH.tan }}>
                    <span className="font-serif text-xl" style={{ color: COACH.tan }}>0{index + 1}</span>
                    <span className="text-lg">{step}</span>
                  </li>
                ))}
              </ol>
              <button className="mt-8 border px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] disabled:opacity-50" style={{ backgroundColor: COACH.tan, borderColor: COACH.tan, color: COACH.black }} onClick={() => void generatePosters()} disabled={posterStatus === 'loading'}>
                {posterStatus === 'loading' ? 'Generating with Reactor…' : 'Generate localised posters'}
              </button>
              {posterStatus === 'failed' && <p className="mt-3 text-sm" style={{ color: COACH.red }}>Poster generation failed — please try again.</p>}
            </div>

            <div className="border p-5 sm:p-8" style={{ borderColor: COACH.tan }}>
              {planReady ? (
                <>
                  <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: COACH.tan }}>The opportunity</p>
                  <h2 className="mt-2 font-serif text-4xl sm:text-6xl">{STRATEGY.headline}</h2>
                  <div className="mt-7 space-y-3">
                    {STRATEGY.segments.map((segment) => (
                      <div key={segment.label}>
                        <div className="mb-1 flex justify-between text-xs"><span>{segment.label}</span><span>{segment.share}%</span></div>
                        <div className="h-2" style={{ backgroundColor: COACH.cream }}><div className="h-full" style={{ width: `${segment.share}%`, backgroundColor: COACH.tan }} /></div>
                      </div>
                    ))}
                  </div>
                  <h3 className="mt-7 text-[10px] uppercase tracking-[0.3em]" style={{ color: COACH.tan }}>Media plan</h3>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-3">{STRATEGY.mediaPlan.map((item) => <li key={item} className="border p-3 text-sm" style={{ borderColor: COACH.tan }}>{item}</li>)}</ul>
                </>
              ) : <p className="font-serif text-3xl opacity-40">Reading the city…</p>}

              {posterStatus === 'ready' && (
                <div className="mt-8">
                  <h3 className="font-serif text-2xl">Ready to ship</h3>
                  {posters.length > 0 ? (
                    <div className="mt-3 flex gap-3 overflow-x-auto">{posters.map((poster) => <img key={`${poster.neighbourhood}-${poster.url}`} className="h-48 w-36 shrink-0 object-cover" src={poster.url} alt={`${neighbourhoodName(poster.neighbourhood)} localised Coach poster`} />)}</div>
                  ) : <p className="mt-2 text-sm">No posters were returned. Try generating again.</p>}
                </div>
              )}
            </div>
          </div>
          <button className="fixed right-4 top-4 border px-3 py-2 text-xs uppercase tracking-widest" style={{ borderColor: COACH.tan, color: COACH.cream, backgroundColor: COACH.black }} onClick={() => setInsightOpen(false)} aria-label="Close strategy">Close</button>
        </section>
      )}

      {selectedFilm?.film_url && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ backgroundColor: COACH.black }} role="dialog" aria-modal="true" aria-label={`${selectedFilm.name || 'Guest'}'s chapter`}>
          <div className="relative w-full max-w-3xl border p-3" style={{ borderColor: COACH.tan }}>
            <video data-testid="dashboard-film" className="max-h-[80dvh] w-full" style={{ backgroundColor: COACH.black }} src={selectedFilm.film_url} controls autoPlay />
            <button className="absolute right-5 top-5 border px-3 py-2 text-xs uppercase tracking-wider" style={{ backgroundColor: COACH.black, borderColor: COACH.tan, color: COACH.cream }} onClick={() => setSelectedFilm(null)} aria-label="Close film">Close</button>
          </div>
        </div>
      )}
    </main>
  )
}
