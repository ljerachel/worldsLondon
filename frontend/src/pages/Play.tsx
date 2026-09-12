import { useCallback, useEffect, useRef, useState } from 'react'
import Mirror from '../components/Mirror'
import { BAGS, CHAPTERS, COACH, NEIGHBOURHOODS } from '../data/config'
import type { BagKey, ChapterKey, NeighbourhoodKey } from '../data/config'
import { api } from '../lib/api'
import type { Session } from '../lib/api'
import { openWorld } from '../lib/world'
import type { WorldHandle } from '../lib/world'

// TODO (Builder A — tickets T5/T7 in the build spec):
// Screen 1: "Tap to enter Coach's London" -> POST /api/session, gyro permission, prefetch Reactor JWT
// Screen 2: 3 questions (neighbourhood / chapter / bag) + optional name -> POST /api/answers
// Screen 3: street via openWorld() (lib/world.ts); tilt-look, hold-to-walk, "Enter Coach" chip
// Screen 4: <Mirror /> (Builder C) — X2 try-on
// Screen 5: "Your chapter" — pick line -> POST /api/film -> poll session -> play film_url; share + CTA
export type PlayStage = 'enter' | 'questions' | 'street' | 'mirror' | 'film'

export interface MirrorStageProps {
  session: Session
  jwt: string | null
  onComplete: () => void
}

export interface FilmStageProps {
  session: Session
}

type QuestionStep = 'neighbourhood' | 'chapter' | 'bag' | 'name'

type OrientationPermissionEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

const screenClass = 'relative h-[100dvh] w-full overflow-hidden touch-none text-[#F3EBDD]'
const screenStyle = { backgroundColor: COACH.black }
const choiceClass =
  'min-h-16 w-full rounded-full border border-[#B3894F]/70 px-6 py-4 text-left text-lg tracking-wide transition active:scale-[0.98]'

function BrandMark() {
  return (
    <div className="font-serif text-sm uppercase tracking-[0.32em] text-[#F3EBDD]/80">
      Coach <span className="text-[#B3894F]">&amp;</span> You
    </div>
  )
}

function Entry({ loading, error, onEnter }: { loading: boolean; error: string; onEnter: () => void }) {
  return (
    <main className={`${screenClass} flex items-center justify-center px-8`} style={screenStyle}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(179,137,79,0.28),transparent_35%)]" />
      <div className="relative flex w-full max-w-md flex-col items-center text-center">
        <div className="mb-12 flex h-24 w-24 items-center justify-center rounded-full border border-[#B3894F]/60 font-serif text-6xl text-[#B3894F] shadow-[0_0_70px_rgba(179,137,79,0.38)]">
          C
        </div>
        <p className="mb-4 text-xs uppercase tracking-[0.35em] text-[#B3894F]">&amp;Coach · Your London</p>
        <button
          type="button"
          disabled={loading}
          onClick={onEnter}
          className="min-h-16 w-full rounded-full border border-[#F3EBDD]/40 px-7 py-4 font-serif text-3xl transition active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? 'Opening London…' : "Tap to enter Coach's London"}
        </button>
        {error && (
          <div role="alert" className="mt-6 rounded-2xl border border-[#8a1f2d] bg-[#8a1f2d]/20 p-4 text-sm">
            <p>{error}</p>
            <p className="mt-1 text-[#F3EBDD]/70">Tap again to retry.</p>
          </div>
        )}
      </div>
    </main>
  )
}

function QuestionFrame({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <main className={`${screenClass} overflow-y-auto px-6 py-8`} style={screenStyle}>
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
        <BrandMark />
        <div className="my-auto py-10">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-[#B3894F]">{eyebrow}</p>
          <h1 className="mb-8 font-serif text-4xl leading-tight">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  )
}

function Questions({ id, onComplete }: { id: string; onComplete: (session: Session) => void }) {
  const [step, setStep] = useState<QuestionStep>('neighbourhood')
  const [neighbourhood, setNeighbourhood] = useState<NeighbourhoodKey | null>(null)
  const [chapter, setChapter] = useState<ChapterKey | null>(null)
  const [bag, setBag] = useState<BagKey | null>(null)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!neighbourhood || !chapter || !bag || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const session = await api.sendAnswers({ id, name: name.trim(), neighbourhood, chapter, bag })
      onComplete(session)
    } catch {
      setError("Your London couldn't be prepared just yet.")
      setSubmitting(false)
    }
  }

  if (step === 'neighbourhood') {
    return (
      <QuestionFrame eyebrow="01 · Place" title="Where's your London?">
        <div className="grid gap-3">
          {(Object.entries(NEIGHBOURHOODS) as [NeighbourhoodKey, (typeof NEIGHBOURHOODS)[NeighbourhoodKey]][]).map(
            ([key, item]) => (
              <button
                type="button"
                className={choiceClass}
                style={{ backgroundColor: `${COACH.black}4d` }}
                key={key}
                onClick={() => {
                  setNeighbourhood(key)
                  setStep('chapter')
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      </QuestionFrame>
    )
  }

  if (step === 'chapter') {
    return (
      <QuestionFrame eyebrow="02 · Story" title="What's the next chapter?">
        <div className="grid gap-3">
          {(Object.entries(CHAPTERS) as [ChapterKey, (typeof CHAPTERS)[ChapterKey]][]).map(([key, item]) => (
            <button
              type="button"
              className={choiceClass}
              style={{ backgroundColor: `${COACH.black}4d` }}
              key={key}
              onClick={() => {
                setChapter(key)
                setStep('bag')
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </QuestionFrame>
    )
  }

  if (step === 'bag') {
    return (
      <QuestionFrame eyebrow="03 · Companion" title="Pick your companion">
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(BAGS) as [BagKey, string][]).map(([key, label]) => (
            <button
              type="button"
              aria-label={label}
              className="relative min-h-48 overflow-hidden rounded-3xl border border-[#B3894F]/60 p-3 text-left transition active:scale-[0.98]"
              style={{ background: `linear-gradient(145deg, #2a2118, ${COACH.black})` }}
              key={key}
              onClick={() => {
                setBag(key)
                setStep('name')
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center font-serif text-5xl text-[#B3894F]/20">C</div>
              <img
                src={`/looks/${key}-1.png`}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
              <span className="absolute inset-x-3 bottom-3 font-serif text-lg">{label}</span>
            </button>
          ))}
        </div>
      </QuestionFrame>
    )
  }

  return (
    <QuestionFrame eyebrow="04 · Author" title="And you are?">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <label htmlFor="coach-name" className="mb-3 block text-sm text-[#F3EBDD]/70">
          First name (optional)
        </label>
        <input
          id="coach-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="given-name"
          maxLength={30}
          placeholder="Your name"
          className="min-h-16 w-full rounded-full border border-[#B3894F]/70 bg-transparent px-6 text-xl outline-none placeholder:text-[#F3EBDD]/30 focus:border-[#F3EBDD]"
        />
        <button
          type="submit"
          disabled={submitting}
          className="mt-5 min-h-16 w-full rounded-full bg-[#F3EBDD] px-6 font-medium transition active:scale-[0.98] disabled:opacity-60"
          style={{ color: COACH.black }}
        >
          {submitting ? 'Building your street…' : 'Continue to your London'}
        </button>
        {error && (
          <div role="alert" className="mt-5 rounded-2xl border border-[#8a1f2d] bg-[#8a1f2d]/20 p-4 text-sm">
            <p>{error}</p>
            <button type="button" onClick={() => void submit()} className="mt-2 min-h-14 underline">
              Retry
            </button>
          </div>
        )}
      </form>
    </QuestionFrame>
  )
}

function Street({
  session,
  jwt,
  tokenSettled,
  onEnterStore,
  onRetryToken,
}: {
  session: Session
  jwt: string | null
  tokenSettled: boolean
  onEnterStore: () => void
  onRetryToken: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const worldRef = useRef<WorldHandle | null>(null)
  const walkStartedRef = useRef<number | null>(null)
  const swipeStartedRef = useRef<number | null>(null)
  const [reactorDisabled] = useState(() => localStorage.getItem('coach_no_reactor') === '1')
  const [hasFrame, setHasFrame] = useState(false)
  const [fallback, setFallback] = useState(reactorDisabled)
  const [worldError, setWorldError] = useState('')
  const [latency, setLatency] = useState<number | null>(null)
  const [parallax, setParallax] = useState(0)
  const [enterReady, setEnterReady] = useState(false)
  const [retry, setRetry] = useState(0)
  const [typedLength, setTypedLength] = useState(0)
  const neighbourhoodLabel = NEIGHBOURHOODS[session.neighbourhood as NeighbourhoodKey]?.label ?? session.neighbourhood
  const chapterLabel = CHAPTERS[session.chapter as ChapterKey]?.label ?? session.chapter
  const campaignLine = `${chapterLabel}. Coach & you.`
  const tokenUnavailable = tokenSettled && !jwt && !reactorDisabled
  const showingFallback = fallback || tokenUnavailable
  const statusError = worldError || (tokenUnavailable ? 'The live street is taking a different route.' : '')

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTypedLength((length) => {
        if (length >= campaignLine.length) {
          window.clearInterval(timer)
          return length
        }
        return length + 1
      })
    }, 55)
    return () => window.clearInterval(timer)
  }, [campaignLine])

  useEffect(() => {
    const timer = window.setTimeout(() => setEnterReady(true), 25_000)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    let fallbackTimer = 0
    let steerTimer = 0

    if (reactorDisabled || !jwt) return

    fallbackTimer = window.setTimeout(() => setFallback(true), 8_000)

    const connect = async () => {
      try {
        if (!videoRef.current) return
        const world = await openWorld({
          jwt,
          anchorUrl: session.anchor_url,
          prompt: session.street_prompt,
          videoEl: videoRef.current,
          onFirstFrame: () => {
            if (cancelled) return
            setHasFrame(true)
            setFallback(false)
            window.clearTimeout(fallbackTimer)
          },
          onLatency: (ms) => {
            if (!cancelled) setLatency(Math.round(ms))
          },
        })
        if (cancelled) {
          await world.close()
          return
        }
        worldRef.current = world
        steerTimer = window.setInterval(() => {
          world.steer(`${session.street_prompt}, the Coach store glowing ahead, closer`)
        }, 8_000)
      } catch {
        if (!cancelled) {
          setFallback(true)
          setWorldError('The live street is taking a different route.')
        }
      }
    }
    void connect()

    return () => {
      cancelled = true
      window.clearTimeout(fallbackTimer)
      window.clearInterval(steerTimer)
      const world = worldRef.current
      worldRef.current = null
      if (world) void world.close()
    }
  }, [jwt, reactorDisabled, retry, session.anchor_url, session.street_prompt, tokenSettled])

  useEffect(() => {
    let currentLook: 'left' | 'right' | 'idle' = 'idle'
    let currentWorld: WorldHandle | null = null
    const orient = (event: DeviceOrientationEvent) => {
      const gamma = event.gamma ?? 0
      setParallax(Math.max(-1, Math.min(1, gamma / 30)))
      const desired = gamma > 8 ? 'right' : gamma < -8 ? 'left' : 'idle'
      const world = worldRef.current
      if (!world || (desired === currentLook && world === currentWorld)) return
      currentLook = desired
      currentWorld = world
      world.look(desired)
    }
    window.addEventListener('deviceorientation', orient)
    return () => {
      window.removeEventListener('deviceorientation', orient)
    }
  }, [])

  const stopWalking = useCallback(() => {
    worldRef.current?.move('idle')
    const started = walkStartedRef.current
    walkStartedRef.current = null
    if (started !== null) {
      void api.sendEvent(session.id, 'walk', Math.max(1, Math.round(performance.now() - started))).catch(() => undefined)
    }
  }, [session.id])

  useEffect(() => () => stopWalking(), [stopWalking])

  const startWalking = () => {
    if (walkStartedRef.current !== null) return
    walkStartedRef.current = performance.now()
    worldRef.current?.move('forward')
  }

  const finishSwipe = (x: number) => {
    const started = swipeStartedRef.current
    swipeStartedRef.current = null
    if (started === null || Math.abs(x - started) < 42) return
    worldRef.current?.strafe(x < started ? 'strafe_left' : 'strafe_right')
    window.setTimeout(() => worldRef.current?.strafe('idle'), 400)
  }

  return (
    <main
      className={screenClass}
      style={screenStyle}
      onTouchStart={(event) => {
        swipeStartedRef.current = event.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(event) => finishSwipe(event.changedTouches[0]?.clientX ?? 0)}
    >
      <div
        data-testid="street-fallback"
        className="absolute -inset-8 overflow-hidden transition-transform duration-300"
        style={{
          background: `radial-gradient(circle at 55% 40%, ${COACH.red} 0%, #3a2418 34%, ${COACH.black} 75%)`,
          transform: `translateX(${parallax * -10}px) scale(1.08)`,
        }}
      >
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(115deg,transparent_30%,rgba(243,235,221,.28)_50%,transparent_70%)]" />
        <div className="absolute inset-x-0 bottom-36 text-center font-serif text-2xl text-[#B3894F]/70">Exploring {neighbourhoodLabel}</div>
        <img
          src={session.anchor_url}
          alt={`${neighbourhoodLabel} street at campaign hour`}
          className="h-full w-full object-cover transition-transform duration-[8000ms] ease-linear motion-safe:scale-110"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      </div>
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${hasFrame && !showingFallback ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(to bottom, ${COACH.black}8c, transparent, ${COACH.black}b3)` }}
      />
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <BrandMark />
        <div
          className="rounded-full border border-white/25 px-3 py-2 text-[10px] uppercase tracking-[0.18em] backdrop-blur"
          style={{ backgroundColor: `${COACH.black}73` }}
        >
          {showingFallback ? 'Still mode' : hasFrame ? `${latency ?? '—'} ms` : 'Opening street'}
        </div>
      </div>
      <div className="absolute left-6 right-6 top-1/4">
        <p className="text-xs uppercase tracking-[0.3em] text-[#B3894F]">Your next chapter</p>
        <h1 aria-label={campaignLine} className="mt-2 max-w-xs font-serif text-5xl leading-[0.95] drop-shadow-lg">
          {campaignLine.slice(0, typedLength)}
        </h1>
      </div>
      {statusError && (
        <div
          role="alert"
          className="absolute left-5 right-5 top-1/2 rounded-2xl border border-[#B3894F]/60 p-4 text-sm backdrop-blur"
          style={{ backgroundColor: `${COACH.black}b3` }}
        >
          <p>{statusError} You can keep walking in still mode.</p>
          <button
            type="button"
            onClick={() => {
              setFallback(false)
              setWorldError('')
              if (tokenUnavailable) onRetryToken()
              else setRetry((value) => value + 1)
            }}
            className="mt-2 min-h-14 underline"
          >
            Retry live street
          </button>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onEnterStore}
          className={`min-h-14 rounded-full border px-7 text-sm uppercase tracking-[0.18em] backdrop-blur transition ${enterReady ? 'animate-pulse border-[#F3EBDD]' : 'border-[#B3894F]/70'}`}
          style={{
            backgroundColor: enterReady ? COACH.tan : `${COACH.black}73`,
            color: enterReady ? COACH.black : COACH.cream,
          }}
        >
          Enter Coach
        </button>
        <button
          type="button"
          aria-label="Hold to walk"
          onPointerDown={(event) => {
            event.stopPropagation()
            event.currentTarget.setPointerCapture(event.pointerId)
            startWalking()
          }}
          onPointerUp={stopWalking}
          onPointerCancel={stopWalking}
          onLostPointerCapture={stopWalking}
          className="flex h-24 w-24 select-none items-center justify-center rounded-full border border-white/45 bg-white/15 text-xs uppercase tracking-[0.2em] backdrop-blur active:scale-95 active:bg-white/30"
        >
          Hold to walk
        </button>
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">Tilt to look · Swipe to strafe</p>
      </div>
    </main>
  )
}

export function MirrorStage({ session, jwt, onComplete }: MirrorStageProps) {
  return (
    <section
      data-testid="mirror-stage"
      data-session-id={session.id}
      data-token-ready={jwt ? 'true' : 'false'}
      className={screenClass}
      style={screenStyle}
    >
      <Mirror id={session.id} jwt={jwt} bag={session.bag} onContinue={onComplete} />
    </section>
  )
}

const CHAPTER_LINE_ALTERNATIVES: Record<ChapterKey, [string, string]> = {
  firstday: ['A new door. I walked through it.', 'First step taken. The rest is mine.'],
  bignight: ['The night starts when I arrive.', 'No rules tonight. Just my story.'],
  sunday: ['Taking my time looks good on me.', 'Today can stay beautifully unplanned.'],
  leaving: ['The next place is calling my name.', 'I packed light and kept the courage.'],
  meeting: ['Right on time for something real.', 'Maybe this is where the story starts.'],
}

type FilmView = 'picker' | 'pending' | 'ready' | 'failed' | 'confirmation'

export function FilmStage({ session }: FilmStageProps) {
  const chapter = CHAPTERS[session.chapter as ChapterKey]
  const defaultLine = chapter?.line ?? session.line
  const alternatives = CHAPTER_LINE_ALTERNATIVES[session.chapter as ChapterKey] ?? [
    'This chapter is mine to write.',
    'London looks different from here.',
  ]
  const lines = [defaultLine, ...alternatives]
  const neighbourhood = NEIGHBOURHOODS[session.neighbourhood as NeighbourhoodKey]?.label ?? session.neighbourhood
  const bag = BAGS[session.bag as BagKey] ?? session.bag
  const author = session.name ? `${session.name}'s` : 'Your'
  const [view, setView] = useState<FilmView>(() => {
    if (session.film_status === 'ready') return session.film_url ? 'ready' : 'failed'
    if (session.film_status === 'pending') return 'pending'
    if (session.film_status === 'failed') return 'failed'
    return 'picker'
  })
  const [selectedLine, setSelectedLine] = useState<string>(defaultLine)
  const [filmLine, setFilmLine] = useState<string>(defaultLine)
  const [writingCustom, setWritingCustom] = useState(false)
  const [customLine, setCustomLine] = useState('')
  const [filmUrl, setFilmUrl] = useState(session.film_url)
  const [feedback, setFeedback] = useState('')
  const [completion, setCompletion] = useState<'reserve' | 'send' | null>(session.cta)
  const [generationSeconds, setGenerationSeconds] = useState(0)
  const filmVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (view !== 'pending') return
    const ticker = window.setInterval(() => setGenerationSeconds((seconds) => seconds + 1), 1_000)
    return () => window.clearInterval(ticker)
  }, [view])

  useEffect(() => {
    if (view !== 'pending') return
    let cancelled = false
    let pollTimer = 0

    const poll = async () => {
      try {
        const latest = await api.getSession(session.id)
        if (cancelled) return
        if (latest.film_status === 'ready') {
          if (latest.film_url) {
            setFilmUrl(latest.film_url)
            setView('ready')
          } else {
            setView('failed')
          }
          return
        }
        if (latest.film_status === 'failed') {
          setView('failed')
          return
        }
      } catch {
        if (!cancelled) setFeedback('Still connecting to the cutting room…')
      }
      if (!cancelled) pollTimer = window.setTimeout(() => void poll(), 2_000)
    }

    pollTimer = window.setTimeout(() => void poll(), 2_000)
    return () => {
      cancelled = true
      window.clearTimeout(pollTimer)
    }
  }, [session.id, view])

  const makeFilm = async () => {
    const line = writingCustom ? customLine.trim() : selectedLine
    if (!line) return
    setFeedback('')
    setFilmLine(line)
    setGenerationSeconds(0)
    setView('pending')
    try {
      await api.sendEvent(session.id, 'line', line)
      const started = await api.startFilm(session.id)
      if (started.film_status === 'failed') setView('failed')
    } catch {
      setView('failed')
    }
  }

  const shareFilm = async () => {
    if (!filmUrl) return
    const payload = {
      title: `&Coach · ${author} London chapter`,
      text: `${filmLine} — &Coach`,
      url: filmUrl,
    }
    try {
      if (window.navigator.share) {
        await window.navigator.share(payload)
        setFeedback('Chapter shared.')
      } else {
        await window.navigator.clipboard.writeText(filmUrl)
        setFeedback('Film link copied.')
      }
      await api.sendEvent(session.id, 'share')
    } catch {
      setFeedback('Your chapter is ready to share when you are.')
    }
  }

  const hearChapter = () => {
    const video = filmVideoRef.current
    if (!video) return
    video.currentTime = 0
    video.muted = false
    void video.play().catch(() => setFeedback('Tap play to hear your chapter.'))
  }

  const chooseCta = async (value: 'reserve' | 'send') => {
    setFeedback('')
    try {
      await api.sendEvent(session.id, 'cta', value)
      setCompletion(value)
      setView('confirmation')
    } catch {
      setFeedback('That next step is taking a moment. Please try again.')
    }
  }

  const shellClass =
    'relative h-[100dvh] w-full touch-pan-y overflow-y-auto px-6 py-8 text-[#F3EBDD] transition-opacity duration-500'

  if (view === 'picker') {
    return (
      <section data-testid="film-stage" data-session-id={session.id} className={shellClass} style={screenStyle}>
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
          <BrandMark />
          <div className="my-auto py-8">
            <p className="mb-3 text-xs uppercase tracking-[0.3em] text-[#B3894F]">05 · Your chapter</p>
            <h1 className="font-serif text-5xl leading-none">Say your line.</h1>
            <p className="mt-4 text-[#F3EBDD]/65">Choose the words that make this story yours.</p>
            <div className="mt-7 grid gap-3">
              {lines.map((line) => (
                <button
                  type="button"
                  key={line}
                  aria-label={`Choose line: ${line}`}
                  aria-pressed={!writingCustom && selectedLine === line}
                  onClick={() => {
                    setWritingCustom(false)
                    setSelectedLine(line)
                  }}
                  className={`min-h-16 rounded-3xl border px-5 py-4 text-left font-serif text-lg transition active:scale-[0.98] ${
                    !writingCustom && selectedLine === line
                      ? 'border-[#F3EBDD] bg-[#B3894F] text-[#0a0a0a]'
                      : 'border-[#B3894F]/60 bg-[#0a0a0a]'
                  }`}
                >
                  “{line}”
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setWritingCustom(true)}
              aria-pressed={writingCustom}
              className="mt-3 min-h-14 w-full rounded-full border border-[#F3EBDD]/35 px-5 text-sm uppercase tracking-[0.16em] transition active:scale-[0.98]"
            >
              Write your own line
            </button>
            {writingCustom && (
              <label className="mt-4 block text-sm text-[#F3EBDD]/70">
                Your chapter line
                <textarea
                  autoFocus
                  value={customLine}
                  onChange={(event) => setCustomLine(event.target.value)}
                  maxLength={120}
                  rows={2}
                  className="mt-2 min-h-20 w-full resize-none rounded-3xl border border-[#B3894F]/70 bg-transparent px-5 py-4 text-base text-[#F3EBDD] outline-none focus:border-[#F3EBDD]"
                />
              </label>
            )}
            <button
              type="button"
              disabled={writingCustom && !customLine.trim()}
              onClick={() => void makeFilm()}
              className="mt-5 min-h-16 w-full rounded-full bg-[#F3EBDD] px-6 font-medium text-[#0a0a0a] transition active:scale-[0.98] disabled:opacity-40"
            >
              Make my film
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (view === 'pending') {
    return (
      <section data-testid="film-stage" data-session-id={session.id} className={`${screenClass} flex items-end p-6`} style={screenStyle}>
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55 motion-safe:animate-pulse"
          style={{ backgroundImage: `url(${session.selfie_url ?? session.anchor_url})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/35 to-[#0a0a0a]/70" />
        <div className="absolute right-5 top-5 rounded-full border border-[#B3894F]/70 bg-[#0a0a0a]/70 px-3 py-2 text-[10px] uppercase tracking-[0.16em]">
          LTX · {generationSeconds}s
        </div>
        <div className="relative w-full pb-[max(1rem,env(safe-area-inset-bottom))]">
          <BrandMark />
          <h1 className="mt-5 font-serif text-5xl leading-none">Cutting your chapter…</h1>
          <p className="mt-4 text-sm uppercase tracking-[0.18em] text-[#B3894F]">
            &amp;Coach · {session.name || 'You'}, {neighbourhood}
          </p>
          <p aria-live="polite" className="mt-3 min-h-6 text-sm text-[#F3EBDD]/65">
            {feedback || 'Your nine-second London story is taking shape.'}
          </p>
        </div>
      </section>
    )
  }

  if (view === 'failed') {
    return (
      <section data-testid="film-stage" data-session-id={session.id} className={`${shellClass} flex items-center`} style={screenStyle}>
        <div role="alert" className="mx-auto w-full max-w-md rounded-[2rem] border border-[#8a1f2d] bg-[#8a1f2d]/15 p-7 text-center">
          <BrandMark />
          <h1 className="mt-6 font-serif text-4xl">Your film couldn't be cut just yet.</h1>
          <p className="mt-4 text-[#F3EBDD]/70">Your line is saved. Return to the cutting room whenever you're ready.</p>
          <button
            type="button"
            onClick={() => {
              setFeedback('')
              setView('picker')
            }}
            className="mt-7 min-h-14 w-full rounded-full bg-[#F3EBDD] px-6 text-[#0a0a0a] transition active:scale-[0.98]"
          >
            Try again
          </button>
        </div>
      </section>
    )
  }

  if (view === 'confirmation') {
    return (
      <section data-testid="film-stage" data-session-id={session.id} className={`${shellClass} flex items-center text-center`} style={screenStyle}>
        <div className="mx-auto w-full max-w-md">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[#B3894F] font-serif text-5xl text-[#B3894F]">C</div>
          <p className="mt-8 text-xs uppercase tracking-[0.3em] text-[#B3894F]">&amp;Coach · Chapter complete</p>
          <h1 className="mt-4 font-serif text-5xl leading-none">
            {completion === 'reserve' ? 'See you on Regent Street.' : 'Your chapter is ready to travel.'}
          </h1>
          <p className="mt-5 text-[#F3EBDD]/70">{author} next chapter starts here, with Coach &amp; you.</p>
        </div>
      </section>
    )
  }

  return (
    <section data-testid="film-stage" data-session-id={session.id} className={shellClass} style={screenStyle}>
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
        <BrandMark />
        <div className="relative mx-auto mt-6 aspect-[9/16] max-h-[56dvh] w-full overflow-hidden rounded-[2rem] border shadow-[0_18px_70px_rgba(179,137,79,0.24)]" style={{ backgroundColor: COACH.black, borderColor: `${COACH.tan}99` }}>
          <video ref={filmVideoRef} data-testid="chapter-film" src={filmUrl ?? undefined} autoPlay muted loop playsInline controls className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 pt-16" style={{ background: `linear-gradient(to top, ${COACH.black}d9, transparent)` }}>
            <p className="font-serif text-2xl">&amp;Coach · {session.name || 'You'}, {neighbourhood}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={hearChapter} className="min-h-14 rounded-full border px-6 font-medium transition active:scale-[0.98]" style={{ backgroundColor: COACH.tan, borderColor: COACH.cream, color: COACH.black }}>
            Hear my chapter
          </button>
          <button type="button" onClick={() => void shareFilm()} className="min-h-14 rounded-full px-6 font-medium transition active:scale-[0.98]" style={{ backgroundColor: COACH.cream, color: COACH.black }}>
            Share your chapter
          </button>
          <button type="button" onClick={() => void chooseCta('reserve')} className="min-h-14 rounded-full border border-[#B3894F] px-5 transition active:scale-[0.98]">
            Reserve the {bag} at Coach Regent Street
          </button>
          <button type="button" onClick={() => void chooseCta('send')} className="min-h-14 rounded-full border border-[#F3EBDD]/35 px-5 transition active:scale-[0.98]">
            Send to a friend
          </button>
          <p aria-live="polite" className="min-h-6 text-center text-sm text-[#B3894F]">{feedback}</p>
        </div>
      </div>
    </section>
  )
}

function SmoothDemo() {
  const [stage, setStage] = useState<'enter' | 'street' | 'done'>('enter')
  const sceneRef = useRef<HTMLDivElement>(null)
  const input = useRef({ target: 0, neutral: null as number | null, walking: false, dragX: null as number | null })

  useEffect(() => {
    if (stage !== 'street') return
    input.current = { target: 0, neutral: null, walking: false, dragX: null }
    let frame = 0
    let previous = performance.now()
    let pan = 0
    let zoom = 1.18
    const animate = (now: number) => {
      const dt = Math.max(0, Math.min(50, now - previous))
      previous = now
      pan += (input.current.target - pan) * (1 - Math.exp(-dt / 65))
      if (Math.abs(input.current.target - pan) < 0.001) pan = input.current.target
      if (input.current.walking) zoom = Math.min(1.65, zoom + dt * 0.000035)
      if (sceneRef.current) {
        sceneRef.current.style.transform = `translate3d(${(pan * -Math.min(window.innerWidth * 0.06, 55)).toFixed(3)}px, 0, 0) scale(${zoom.toFixed(5)})`
      }
      frame = window.requestAnimationFrame(animate)
    }
    const orient = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || !Number.isFinite(event.gamma) || input.current.dragX !== null) return
      input.current.neutral ??= event.gamma
      const tilt = event.gamma - input.current.neutral
      input.current.target = Math.abs(tilt) < 1 ? 0 : Math.max(-1, Math.min(1, tilt / 25))
    }
    const stop = () => {
      input.current.walking = false
      input.current.dragX = null
      previous = performance.now()
    }
    frame = window.requestAnimationFrame(animate)
    window.addEventListener('deviceorientation', orient)
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', stop)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('deviceorientation', orient)
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', stop)
      stop()
    }
  }, [stage])

  const start = () => {
    const orientation = window.DeviceOrientationEvent as OrientationPermissionEvent | undefined
    if (orientation?.requestPermission) void orientation.requestPermission().catch(() => 'denied')
    setStage('street')
  }
  const actionClass = 'min-h-14 rounded-full border border-[#B3894F]/70 bg-[#0a0a0a]/80 px-7 py-3 text-sm uppercase tracking-[0.15em]'

  if (stage !== 'street') {
    return (
      <main className={`${screenClass} flex items-center justify-center px-7`} style={screenStyle}>
        <img src="/neigh/soho-bignight.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="relative w-full max-w-md text-center">
          <BrandMark />
          <p className="mt-5 text-xs uppercase tracking-[0.2em] text-[#B3894F]">Smooth demo · Soho · Big night</p>
          <h1 className="mt-5 font-serif text-5xl">{stage === 'done' ? 'Your Soho chapter.' : 'One night in Soho.'}</h1>
          {stage === 'done' ? (
            <>
              <img src="/looks/brooklyn-1.png" alt="Brooklyn bag look" className="mx-auto mt-6 max-h-[35dvh] rounded-3xl object-contain" />
              <p className="my-5">Brooklyn. Your companion for the night.</p>
              <button type="button" className={actionClass} onClick={start}>Walk again</button>
            </>
          ) : (
            <>
              <p className="my-6 text-[#F3EBDD]/75">A local pan-and-zoom demo. Tilt or drag to look, hold to move closer. No live generation.</p>
              <button type="button" className={actionClass} onClick={start}>Start smooth Soho demo</button>
            </>
          )}
        </div>
      </main>
    )
  }

  return (
    <main
      className={screenClass}
      style={screenStyle}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('button')) return
        input.current.dragX = event.clientX
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }}
      onPointerMove={(event) => {
        const x = input.current.dragX
        if (x === null) return
        input.current.target = Math.max(-1, Math.min(1, input.current.target - (event.clientX - x) / 150))
        input.current.dragX = event.clientX
      }}
      onPointerUp={() => { input.current.dragX = null }}
      onPointerCancel={() => { input.current.dragX = null }}
      onLostPointerCapture={() => { input.current.dragX = null }}
    >
      <div ref={sceneRef} data-testid="demo-scene" className="absolute inset-0 will-change-transform" style={{ transform: 'translate3d(0px, 0, 0) scale(1.18)' }}>
        <img src="/neigh/soho-bignight.png" alt="Soho at night" draggable={false} className="pointer-events-none h-full w-full select-none object-cover" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
      <div className="pointer-events-none absolute inset-x-0 top-0 p-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <BrandMark />
        <p className="mt-3 text-xs uppercase tracking-[0.15em]">Smooth demo · local scene</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button type="button" className={actionClass} onClick={() => setStage('done')}>Enter Coach</button>
        <button
          type="button"
          className="flex h-24 w-24 select-none items-center justify-center rounded-full border border-white/60 bg-black/50 text-xs uppercase tracking-widest active:scale-95 active:bg-[#B3894F]/70"
          onPointerDown={(event) => {
            event.stopPropagation()
            event.currentTarget.setPointerCapture?.(event.pointerId)
            input.current.walking = true
          }}
          onPointerUp={() => { input.current.walking = false }}
          onPointerCancel={() => { input.current.walking = false }}
          onLostPointerCapture={() => { input.current.walking = false }}
        >Hold to walk</button>
        <p className="text-xs text-white/80">Tilt or drag to look · Hold to move closer</p>
        <button type="button" className="min-h-11 px-5 text-xs underline" onClick={() => {
          input.current.neutral = null
          input.current.target = 0
        }}>Recenter tilt</button>
      </div>
    </main>
  )
}

export default function Play() {
  return new URLSearchParams(window.location.search).get('demo') === '1' ? <SmoothDemo /> : <LivePlay />
}

function LivePlay() {
  const [stage, setStage] = useState<PlayStage>('enter')
  const [questionStepKey, setQuestionStepKey] = useState(0)
  const [sessionId, setSessionId] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [jwt, setJwt] = useState<string | null>(null)
  const [tokenSettled, setTokenSettled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [entryError, setEntryError] = useState('')

  const enter = async () => {
    if (loading) return
    setLoading(true)
    setEntryError('')
    const orientation = window.DeviceOrientationEvent as OrientationPermissionEvent | undefined
    if (orientation?.requestPermission) void orientation.requestPermission().catch(() => 'denied')

    setTokenSettled(false)
    void api
      .reactorToken()
      .then(({ jwt: token }) => {
        setJwt(token)
        return token
      })
      .catch(() => null)
      .finally(() => setTokenSettled(true))

    try {
      const created = await api.createSession()
      setSessionId(created.id)
      setQuestionStepKey((key) => key + 1)
      setStage('questions')
    } catch {
      setEntryError("Coach's London couldn't open just yet.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!sessionId) return
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void api.sendEvent(sessionId, 'drop').catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [sessionId])

  if (stage === 'enter') return <Entry loading={loading} error={entryError} onEnter={() => void enter()} />

  if (stage === 'questions') {
    return (
      <Questions
        key={questionStepKey}
        id={sessionId}
        onComplete={(answers) => {
          setSession(answers)
          setStage('street')
          void api.sendEvent(answers.id, 'street_enter').catch(() => undefined)
        }}
      />
    )
  }

  if (!session) return <Entry loading={false} error="Your session needs a fresh start." onEnter={() => void enter()} />

  if (stage === 'street') {
    return (
      <Street
        session={session}
        jwt={jwt}
        tokenSettled={tokenSettled}
        onRetryToken={() => {
          setTokenSettled(false)
          void api
            .reactorToken()
            .then(({ jwt: token }) => {
              setJwt(token)
              return token
            })
            .catch(() => null)
            .finally(() => setTokenSettled(true))
        }}
        onEnterStore={() => {
          setStage('mirror')
          void api.sendEvent(session.id, 'store_enter').catch(() => undefined)
        }}
      />
    )
  }

  if (stage === 'mirror') return <MirrorStage session={session} jwt={jwt} onComplete={() => setStage('film')} />

  return <FilmStage session={session} />
}
