import { X2Provider, useX2, useX2Track } from '@reactor-models/x2'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BAGS, COACH } from '../data/config'
import type { BagKey } from '../data/config'
import { api } from '../lib/api'
import { captureWebcamFrame, fetchLookBoard, lookBoardUrl, MIRROR_LOOKS, MIRROR_PROMPT } from '../lib/mirror'

export interface MirrorProps {
  id: string
  jwt: string | null
  bag: string
  onContinue: () => void
}

interface LiveX2Props {
  sourceTrack: MediaStreamTrack | null
  lookIndex: number
  bag: string
  outputRef: React.RefObject<HTMLVideoElement | null>
  onFrame: () => void
  onFailure: () => void
  registerDisconnect: (disconnect: (() => Promise<void>) | null) => void
}

function LiveX2({ sourceTrack, lookIndex, bag, outputRef, onFrame, onFailure, registerDisconnect }: LiveX2Props) {
  const { status, disconnect, publish, setPrompt, setReferenceImage, uploadFile } = useX2()
  const outputTrack = useX2Track('main_video')
  const promptSetRef = useRef(false)

  useEffect(() => {
    registerDisconnect(() => disconnect())
    return () => registerDisconnect(null)
  }, [disconnect, registerDisconnect])

  useEffect(() => {
    if (status !== 'ready' || !sourceTrack) return
    void publish('source', sourceTrack).catch(onFailure)
  }, [onFailure, publish, sourceTrack, status])

  useEffect(() => {
    if (status !== 'ready') return
    let cancelled = false
    const setLook = async () => {
      try {
        const board = await fetchLookBoard(bag, lookIndex)
        if (cancelled) return
        const reference = await uploadFile(board, { name: `${bag}-${lookIndex + 1}.png` })
        if (cancelled) return
        await setReferenceImage({ reference_image: reference })
        if (!promptSetRef.current) {
          await setPrompt({ prompt: MIRROR_PROMPT })
          promptSetRef.current = true
        }
      } catch {
        if (!cancelled) onFailure()
      }
    }
    void setLook()
    return () => {
      cancelled = true
    }
  }, [bag, lookIndex, onFailure, setPrompt, setReferenceImage, status, uploadFile])

  useEffect(() => {
    const video = outputRef.current
    if (!video || !outputTrack) return
    video.srcObject = new MediaStream([outputTrack])
    void video.play().catch(onFailure)
    return () => {
      if (video.srcObject) video.srcObject = null
    }
  }, [onFailure, outputRef, outputTrack])

  return (
    <video
      ref={outputRef}
      data-testid="x2-output"
      muted
      autoPlay
      playsInline
      onLoadedData={onFrame}
      className="absolute inset-0 h-full w-full object-cover"
    />
  )
}

function LookBoard({ bag, index, label, prominent }: { bag: string; index: number; label: string; prominent: boolean }) {
  const bagLabel = BAGS[bag as BagKey] ?? bag.charAt(0).toUpperCase() + bag.slice(1)
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[#B3894F]/80 bg-[#21170f] shadow-2xl transition-all ${prominent ? 'h-52 w-36' : 'h-28 w-20'}`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#6e422d,#120e0b_70%)] px-2 text-center">
        <span className="font-serif text-4xl text-[#B3894F]/45">C</span>
        <span className="mt-1 text-[8px] uppercase tracking-[0.18em] text-[#F3EBDD]/70">{label}</span>
      </div>
      <img
        src={lookBoardUrl(bag, index)}
        alt={`${bagLabel} ${label} look board`}
        className="relative h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.style.display = 'none'
        }}
      />
    </div>
  )
}

export default function Mirror({ id, jwt, bag, onContinue }: MirrorProps) {
  const sourceVideoRef = useRef<HTMLVideoElement>(null)
  const outputVideoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const disconnectRef = useRef<(() => Promise<void>) | null>(null)
  const stoppedRef = useRef(false)
  const selfieUploadedRef = useRef(false)
  const swipeStartRef = useRef<number | null>(null)
  const [sourceTrack, setSourceTrack] = useState<MediaStreamTrack | null>(null)
  const [lookIndex, setLookIndex] = useState(0)
  const [savedLooks, setSavedLooks] = useState<number[]>([])
  const [hasX2Frame, setHasX2Frame] = useState(false)
  const [cameraError, setCameraError] = useState(false)
  const [reactorFailure, setReactorFailure] = useState(false)
  const [continuing, setContinuing] = useState(false)
  const reactorDisabled = localStorage.getItem('coach_no_reactor') === '1' || !jwt
  const fallback = reactorDisabled || reactorFailure
  const lookLabel = MIRROR_LOOKS[lookIndex]

  const registerDisconnect = useCallback((disconnect: (() => Promise<void>) | null) => {
    disconnectRef.current = disconnect
  }, [])
  const handleX2Frame = useCallback(() => setHasX2Frame(true), [])
  const handleX2Failure = useCallback(() => setReactorFailure(true), [])

  const stopCamera = useCallback(() => {
    if (stoppedRef.current) return
    stoppedRef.current = true
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setSourceTrack(null)
    if (sourceVideoRef.current) sourceVideoRef.current.srcObject = null
  }, [])

  useEffect(() => {
    let cancelled = false
    const openCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        const track = stream.getVideoTracks()[0] ?? null
        setSourceTrack(track)
        if (sourceVideoRef.current) {
          sourceVideoRef.current.srcObject = stream
          await sourceVideoRef.current.play()
        }
      } catch {
        if (!cancelled) setCameraError(true)
      }
    }
    void openCamera()
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [stopCamera])

  useEffect(() => {
    if (!sourceTrack || selfieUploadedRef.current) return
    const timer = window.setTimeout(() => {
      const video = sourceVideoRef.current
      if (!video || selfieUploadedRef.current) return
      selfieUploadedRef.current = true
      void captureWebcamFrame(video)
        .then((blob) => api.uploadSelfie(id, blob))
        .catch(() => undefined)
    }, 3_000)
    return () => window.clearTimeout(timer)
  }, [id, sourceTrack])

  useEffect(() => {
    if (reactorDisabled || hasX2Frame) return
    const timer = window.setTimeout(() => setReactorFailure(true), 8_000)
    return () => window.clearTimeout(timer)
  }, [hasX2Frame, reactorDisabled])

  const changeLook = (next: number) => {
    const index = (next + MIRROR_LOOKS.length) % MIRROR_LOOKS.length
    setLookIndex(index)
    setHasX2Frame(false)
    void api.sendEvent(id, 'look', index).catch(() => undefined)
  }

  const finishSwipe = (endX: number) => {
    const startX = swipeStartRef.current
    swipeStartRef.current = null
    if (startX === null || Math.abs(endX - startX) < 42) return
    changeLook(lookIndex + (endX < startX ? 1 : -1))
  }

  const saveLook = async () => {
    if (savedLooks.includes(lookIndex)) return
    try {
      await api.sendEvent(id, 'save', lookIndex)
      setSavedLooks((looks) => [...looks, lookIndex])
    } catch {
      return
    }
  }

  const continueToFilm = async () => {
    if (continuing) return
    setContinuing(true)
    try {
      await disconnectRef.current?.()
    } catch {}
    stopCamera()
    onContinue()
  }

  const saved = savedLooks.includes(lookIndex)

  return (
    <main
      data-testid="mirror-surface"
      className="relative h-[100dvh] w-full overflow-hidden bg-black text-[#F3EBDD]"
      onTouchStart={(event) => {
        swipeStartRef.current = event.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(event) => finishSwipe(event.changedTouches[0]?.clientX ?? 0)}
    >
      <video
        ref={sourceVideoRef}
        data-testid="source-webcam"
        muted
        autoPlay
        playsInline
        className={`absolute inset-0 h-full w-full scale-x-[-1] object-cover transition-opacity ${fallback && !cameraError ? 'opacity-100' : 'opacity-0'}`}
      />
      {!fallback && jwt && (
        <X2Provider jwtToken={jwt} connectOptions={{ autoConnect: true }}>
          <LiveX2
            sourceTrack={sourceTrack}
            lookIndex={lookIndex}
            bag={bag}
            outputRef={outputVideoRef}
            onFrame={handleX2Frame}
            onFailure={handleX2Failure}
            registerDisconnect={registerDisconnect}
          />
        </X2Provider>
      )}
      {(cameraError || (!hasX2Frame && !fallback)) && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,#553122,#120e0b_70%)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/85" />

      <header className="absolute inset-x-0 top-0 flex items-start justify-between p-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="font-serif text-sm uppercase tracking-[0.32em]">
          Coach <span className="text-[#B3894F]">&amp;</span> You
        </div>
        <div className="rounded-full border border-white/25 bg-black/45 px-3 py-2 text-[10px] uppercase tracking-[0.16em] backdrop-blur">
          {fallback ? 'Live camera · Try in store' : hasX2Frame ? 'Live with X2' : 'Opening live try-on'}
        </div>
      </header>

      {fallback && (
        <div className="absolute right-5 top-24">
          <LookBoard bag={bag} index={lookIndex} label={lookLabel} prominent />
        </div>
      )}
      {!fallback && (
        <div className="absolute right-5 top-24">
          <LookBoard bag={bag} index={lookIndex} label={lookLabel} prominent={false} />
        </div>
      )}

      {cameraError && (
        <div role="alert" className="absolute left-6 right-6 top-1/3 rounded-3xl border border-[#B3894F]/70 bg-black/70 p-6 text-center backdrop-blur">
          <p className="font-serif text-2xl">Your camera is private.</p>
          <p className="mt-2 text-sm text-white/70">Use the look board now and try the full look in store.</p>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mb-4 text-center">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#B3894F]">Look {lookIndex + 1} of 3</p>
          <h1 className="mt-1 font-serif text-3xl">{lookLabel}</h1>
        </div>
        <div className="mb-3 grid grid-cols-[3.5rem_1fr_3.5rem] gap-3">
          <button
            type="button"
            aria-label="Previous look"
            onClick={() => changeLook(lookIndex - 1)}
            className="min-h-14 rounded-full border border-white/35 bg-black/40 text-2xl backdrop-blur"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={saved ? 'Look saved' : 'Save look'}
            onClick={() => void saveLook()}
            className="min-h-14 rounded-full border border-[#B3894F] bg-black/55 px-5 text-sm uppercase tracking-[0.18em] backdrop-blur"
          >
            {saved ? 'Saved' : '♡ Save this look'}
          </button>
          <button
            type="button"
            aria-label="Next look"
            onClick={() => changeLook(lookIndex + 1)}
            className="min-h-14 rounded-full border border-white/35 bg-black/40 text-2xl backdrop-blur"
          >
            ›
          </button>
        </div>
        <button
          type="button"
          disabled={continuing}
          onClick={() => void continueToFilm()}
          className="min-h-14 w-full rounded-full px-6 text-sm font-medium uppercase tracking-[0.18em] disabled:opacity-60"
          style={{ backgroundColor: COACH.cream, color: COACH.black }}
        >
          {continuing ? 'Closing the mirror…' : 'Continue to your chapter'}
        </button>
        <p className="mt-2 text-center text-[9px] uppercase tracking-[0.18em] text-white/55">Swipe to change look</p>
      </div>
    </main>
  )
}
