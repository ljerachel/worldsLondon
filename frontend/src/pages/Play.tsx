import { useCallback, useEffect, useRef, useState } from 'react'
import ImmersiveWorld from '../components/ImmersiveWorld'
import ProductInspector from '../components/ProductInspector'
import { BAGS, CHAPTERS, COACH, NEIGHBOURHOODS } from '../data/config'
import type { BagKey, ChapterKey, NeighbourhoodKey } from '../data/config'
import { PORTAL_VIDEO_URL, PRODUCTS } from '../data/products'
import type { ProductKey } from '../data/products'
import { api } from '../lib/api'
import type { ImmersiveWorldRecord, Session } from '../lib/api'
import { openWorld, WorldCleanupError } from '../lib/world'
import type { WorldHandle } from '../lib/world'

export type PlayStage = 'enter' | 'questions' | 'street' | 'portal' | 'immersive' | 'product' | 'complete'

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
  onEnterStore: (shutdown: Promise<boolean>) => void
  onRetryToken: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const worldRef = useRef<WorldHandle | null>(null)
  const shutdownRef = useRef<() => Promise<boolean>>(() => Promise.resolve(true))
  const enteringStoreRef = useRef(false)
  const lookRef = useRef<'left' | 'right' | 'idle'>('idle')
  const neutralTiltRef = useRef<number | null>(null)
  const fallbackRef = useRef<HTMLDivElement>(null)
  const walkStartedRef = useRef<number | null>(null)
  const swipeStartedRef = useRef<number | null>(null)
  const [reactorDisabled] = useState(() => localStorage.getItem('coach_no_reactor') === '1')
  const [hasFrame, setHasFrame] = useState(false)
  const [fallback, setFallback] = useState(reactorDisabled)
  const [worldError, setWorldError] = useState('')
  const [latency, setLatency] = useState<number | null>(null)
  const [enterReady, setEnterReady] = useState(false)
  const [retry, setRetry] = useState(0)
  const [typedLength, setTypedLength] = useState(0)
  const [enteringStore, setEnteringStore] = useState(false)
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
    let steerTimer = 0
    let world: WorldHandle | null = null
    let cleanupSafe = true
    let shutdownPromise: Promise<boolean> | null = null
    const previousShutdown = shutdownRef.current()

    if (reactorDisabled || !jwt || enteringStoreRef.current) return

    const fallbackTimer = window.setTimeout(() => setFallback(true), 8_000)

    const connect = async () => {
      try {
        cleanupSafe = await previousShutdown
        if (!cleanupSafe) throw new WorldCleanupError('Street cleanup is unresolved')
        if (cancelled || !videoRef.current) return
        world = await openWorld({
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
        if (cancelled) return
        worldRef.current = world
        world.look(lookRef.current)
        if (walkStartedRef.current !== null) world.move('forward')
        steerTimer = window.setInterval(() => {
          world?.steer(`${session.street_prompt}, the Coach store glowing ahead, closer`)
        }, 8_000)
      } catch (error) {
        if (error instanceof WorldCleanupError) cleanupSafe = false
        if (!cancelled) {
          const failure = error as { status?: number; code?: string } | null
          setFallback(true)
          setWorldError(failure?.status === 429 || failure?.code === 'RATE_LIMITED'
            ? 'Live world servers are busy. Please try again shortly.'
            : 'The live street is taking a different route.')
        }
      }
    }
    const opening = connect()
    const shutdown = () => {
      cancelled = true
      window.clearTimeout(fallbackTimer)
      window.clearInterval(steerTimer)
      if (worldRef.current === world) worldRef.current = null
      shutdownPromise ??= opening.then(async () => {
        if (world) {
          try {
            await world.close()
          } catch {
            return false
          }
        }
        return cleanupSafe
      })
      return shutdownPromise
    }
    shutdownRef.current = shutdown

    return () => { void shutdown() }
  }, [jwt, reactorDisabled, retry, session.anchor_url, session.street_prompt, tokenSettled])

  const recenterTilt = useCallback(() => {
    neutralTiltRef.current = null
    lookRef.current = 'idle'
    worldRef.current?.look('idle')
  }, [])

  useEffect(() => {
    let frame = 0
    let parallax = 0
    const orient = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || !Number.isFinite(event.gamma)) return
      neutralTiltRef.current ??= event.gamma
      const gamma = event.gamma - neutralTiltRef.current
      parallax = Math.max(-1, Math.min(1, gamma / 30))
      if (!frame) frame = window.requestAnimationFrame(() => {
        frame = 0
        if (fallbackRef.current) fallbackRef.current.style.transform = `translateX(${parallax * -10}px) scale(1.08)`
      })
      const current = lookRef.current
      const desired = gamma > 12 ? 'right' : gamma < -12 ? 'left'
        : current === 'right' && gamma > 4 ? 'right'
        : current === 'left' && gamma < -4 ? 'left' : 'idle'
      if (desired === current) return
      lookRef.current = desired
      worldRef.current?.look(desired)
    }
    window.addEventListener('deviceorientation', orient)
    return () => {
      window.cancelAnimationFrame(frame)
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

  useEffect(() => {
    const stop = () => {
      stopWalking()
      recenterTilt()
      worldRef.current?.strafe('idle')
    }
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', stop)
    return () => {
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', stop)
      stop()
    }
  }, [recenterTilt, stopWalking])

  const startWalking = () => {
    if (walkStartedRef.current !== null) return
    walkStartedRef.current = performance.now()
    worldRef.current?.move('forward')
  }

  const enterStore = () => {
    if (enteringStoreRef.current) return
    enteringStoreRef.current = true
    setEnteringStore(true)
    stopWalking()
    onEnterStore(shutdownRef.current())
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
        ref={fallbackRef}
        data-testid="street-fallback"
        className="absolute -inset-8 overflow-hidden transition-transform duration-300"
        style={{
          background: `radial-gradient(circle at 55% 40%, ${COACH.red} 0%, #3a2418 34%, ${COACH.black} 75%)`,
          transform: 'translateX(0px) scale(1.08)',
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
          <p>{statusError} Showing the street preview, not live video.</p>
          <a href="/play?demo=1" className="mt-2 flex min-h-11 items-center underline">Use smooth fallback</a>
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
          onClick={() => void enterStore()}
          disabled={enteringStore}
          className={`min-h-14 rounded-full border px-7 text-sm uppercase tracking-[0.18em] backdrop-blur transition disabled:opacity-60 ${enterReady ? 'animate-pulse border-[#F3EBDD]' : 'border-[#B3894F]/70'}`}
          style={{
            backgroundColor: enterReady ? COACH.tan : `${COACH.black}73`,
            color: enterReady ? COACH.black : COACH.cream,
          }}
        >
          {enteringStore ? 'Closing the street…' : 'Enter Coach'}
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
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">Tilt gently to look · Swipe to strafe</p>
        <button type="button" onClick={recenterTilt} className="min-h-11 px-5 text-xs text-white/70 underline">Recenter tilt</button>
      </div>
    </main>
  )
}

function Portal({
  shutdown,
  onReady,
}: {
  shutdown: Promise<boolean>
  onReady: (jwt: string | null, worldPromise: Promise<ImmersiveWorldRecord>) => void
}) {
  const [canEnter, setCanEnter] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [tokenSettled, setTokenSettled] = useState(false)
  const enteredRef = useRef(false)
  const mountedRef = useRef(false)
  const tokenRequestRef = useRef<Promise<string | null>>(Promise.resolve(null))
  const worldRequestRef = useRef<Promise<ImmersiveWorldRecord>>(
    Promise.resolve({ world_id: null }),
  )

  useEffect(() => {
    let cancelled = false
    mountedRef.current = true
    const timer = window.setTimeout(() => setCanEnter(true), 3_000)
    let deadline = 0
    worldRequestRef.current = api.getImmersiveWorld().catch(() => ({ world_id: null }))
    const tokenRequest = api.reactorToken().then(({ jwt }) => jwt).catch(() => null)
    tokenRequestRef.current = Promise.race([
      shutdown.then(async (closed) => closed ? await tokenRequest : null).catch(() => null),
      new Promise<null>((resolve) => {
        deadline = window.setTimeout(() => resolve(null), 8_000)
      }),
    ]).then((jwt) => {
      window.clearTimeout(deadline)
      if (!cancelled) {
        setToken(jwt)
        setTokenSettled(true)
      }
      return jwt
    })
    return () => {
      cancelled = true
      mountedRef.current = false
      window.clearTimeout(timer)
      window.clearTimeout(deadline)
    }
  }, [shutdown])

  const enterWorld = async () => {
    if (enteredRef.current) return
    enteredRef.current = true
    const jwt = await tokenRequestRef.current
    if (mountedRef.current) onReady(jwt, worldRequestRef.current)
  }

  return (
    <main className={screenClass} style={screenStyle}>
      <video
        aria-label="Find Your Courage portal"
        src={PORTAL_VIDEO_URL}
        autoPlay
        muted
        playsInline
        controls
        onEnded={enterWorld}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/75" />
      <div className="absolute inset-x-0 top-0 flex justify-center p-[max(1.25rem,env(safe-area-inset-top))]">
        <BrandMark />
      </div>
      {canEnter && (
        <div className="absolute inset-x-0 bottom-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={enterWorld}
            className="min-h-16 w-full rounded-full bg-[#F3EBDD] px-6 font-semibold uppercase tracking-[0.18em] text-[#0a0a0a] transition active:scale-[0.98]"
          >
            Enter the world
          </button>
          {tokenSettled && !token && (
            <p role="status" className="mt-3 rounded-2xl bg-black/70 p-3 text-center text-sm backdrop-blur">
              The live garden is resting. Exact product views will still be available.
            </p>
          )}
        </div>
      )}
    </main>
  )
}

function Complete({ session, product }: { session: Session; product: ProductKey }) {
  const details = PRODUCTS[product]
  return (
    <main className={`${screenClass} flex items-center px-6 text-center`} style={screenStyle}>
      <div className="mx-auto w-full max-w-md">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[#B3894F] font-serif text-5xl text-[#B3894F]">C</div>
        <p className="mt-8 text-xs uppercase tracking-[0.3em] text-[#B3894F]">&amp;Coach · Selection complete</p>
        <h1 className="mt-4 font-serif text-5xl leading-none">Carry your courage.</h1>
        <p className="mt-5 text-lg text-[#F3EBDD]/75">
          {session.name || 'Your'} chose the Coach {details.label}.
        </p>
      </div>
    </main>
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
  const [streetJwt, setStreetJwt] = useState<string | null>(null)
  const [streetTokenSettled, setStreetTokenSettled] = useState(false)
  const [immersiveJwt, setImmersiveJwt] = useState<string | null>(null)
  const [immersiveWorldPromise, setImmersiveWorldPromise] = useState<Promise<ImmersiveWorldRecord>>(
    () => Promise.resolve({ world_id: null }),
  )
  const [inspectedProduct, setInspectedProduct] = useState<ProductKey | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductKey | null>(null)
  const [loading, setLoading] = useState(false)
  const [entryError, setEntryError] = useState('')
  const [streetShutdown, setStreetShutdown] = useState<Promise<boolean>>(() => Promise.resolve(false))
  const streetClosedRef = useRef(false)
  const immersiveEnteredRef = useRef(false)
  const worldStartedRef = useRef<number | null>(null)
  const worldTimeSentRef = useRef(false)

  const fetchStreetToken = useCallback(() => {
    setStreetTokenSettled(false)
    void api.reactorToken()
      .then(({ jwt }) => setStreetJwt(jwt))
      .catch(() => setStreetJwt(null))
      .finally(() => setStreetTokenSettled(true))
  }, [])

  const retryImmersiveToken = useCallback(async () => {
    if (!streetClosedRef.current) return null
    try {
      const { jwt } = await api.reactorToken()
      setImmersiveJwt(jwt)
      return jwt
    } catch {
      return null
    }
  }, [])

  const enter = async () => {
    if (loading) return
    setLoading(true)
    setEntryError('')
    const orientation = window.DeviceOrientationEvent as OrientationPermissionEvent | undefined
    if (orientation?.requestPermission) void orientation.requestPermission().catch(() => 'denied')
    fetchStreetToken()

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

  const sendWorldTime = useCallback(() => {
    if (!session || worldStartedRef.current === null || worldTimeSentRef.current) return
    worldTimeSentRef.current = true
    const elapsed = Math.max(1, Math.round(performance.now() - worldStartedRef.current))
    void api.sendEvent(session.id, 'world_time', elapsed).catch(() => undefined)
  }, [session])

  useEffect(() => {
    if (!sessionId) return
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return
      void api.sendEvent(sessionId, 'drop').catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [sessionId])

  useEffect(() => () => sendWorldTime(), [sendWorldTime])

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
        jwt={streetJwt}
        tokenSettled={streetTokenSettled}
        onRetryToken={fetchStreetToken}
        onEnterStore={(shutdown) => {
          setStreetShutdown(shutdown)
          void shutdown.then((closed) => { streetClosedRef.current = closed })
          setStage('portal')
          void api.sendEvent(session.id, 'store_enter').catch(() => undefined)
        }}
      />
    )
  }

  if (stage === 'portal') {
    return (
      <Portal
        shutdown={streetShutdown}
        onReady={(jwt, worldPromise) => {
          setImmersiveJwt(jwt)
          setImmersiveWorldPromise(worldPromise)
          setStage('immersive')
          worldStartedRef.current = performance.now()
          if (!immersiveEnteredRef.current) {
            immersiveEnteredRef.current = true
            void api.sendEvent(session.id, 'immersive_enter').catch(() => undefined)
          }
        }}
      />
    )
  }

  if (stage === 'complete' && selectedProduct) {
    return <Complete session={session} product={selectedProduct} />
  }

  const viewProduct = (product: ProductKey) => {
    setInspectedProduct(product)
    setStage('product')
    void api.sendEvent(session.id, 'product_view', product).catch(() => undefined)
  }

  return (
    <>
      <ImmersiveWorld
        id={session.id}
        jwt={immersiveJwt}
        worldPromise={immersiveWorldPromise}
        onRetryToken={retryImmersiveToken}
        onViewProduct={viewProduct}
      />
      {stage === 'product' && inspectedProduct && (
        <ProductInspector
          initialProduct={inspectedProduct}
          onView={viewProduct}
          onClose={() => {
            setInspectedProduct(null)
            setStage('immersive')
          }}
          onSelect={(product) => {
            setSelectedProduct(product)
            setInspectedProduct(null)
            sendWorldTime()
            void api.sendEvent(session.id, 'product_select', product).catch(() => undefined)
            setStage('complete')
          }}
        />
      )}
    </>
  )
}
