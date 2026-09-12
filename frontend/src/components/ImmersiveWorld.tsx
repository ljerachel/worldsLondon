import {
  HappyOysterProvider,
  HappyOysterVideo,
  useHappyOyster,
  useHappyOysterTravelError,
} from '@reactor-models/happy-oyster/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { PORTAL_VIDEO_URL, PRODUCTS, WORLD_ANCHOR_URL } from '../data/products'
import type { ProductKey } from '../data/products'
import { api } from '../lib/api'
import type { ImmersiveWorldRecord } from '../lib/api'
import {
  IMMERSIVE_PROMPT,
  IMMERSIVE_STREAM_TIMEOUT_MS,
  reactorKillSwitchEnabled,
} from '../lib/immersive'
import type { ImmersiveStatus } from '../lib/immersive'

export interface ImmersiveWorldProps {
  id: string
  jwt: string | null
  worldPromise: Promise<ImmersiveWorldRecord>
  onRetryToken?: () => Promise<string | null>
  onViewProduct: (product: ProductKey) => void
}

type FallbackReason = 'kill-switch' | 'token' | 'timeout' | 'error'

type ExperienceProps = Omit<ImmersiveWorldProps, 'jwt' | 'onRetryToken'> & {
  onFallback: (
    reason: Exclude<FallbackReason, 'kill-switch'>,
    disconnected: Promise<void>,
  ) => void
}

const CONTROL_CLASS = 'min-h-14 rounded-full border border-[#F3EBDD]/45 bg-black/65 px-4 text-sm font-semibold text-[#F3EBDD] shadow-lg backdrop-blur transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40'

function ProductControls({ onViewProduct }: Pick<ImmersiveWorldProps, 'onViewProduct'>) {
  return (
    <div className="grid grid-cols-2 gap-2" aria-label="Product plinths">
      {(Object.keys(PRODUCTS) as ProductKey[]).map((product) => (
        <button
          key={product}
          type="button"
          className={CONTROL_CLASS}
          onClick={() => onViewProduct(product)}
        >
          Explore {PRODUCTS[product].label}
        </button>
      ))}
    </div>
  )
}

function PortalBackground() {
  return (
    <video
      aria-label="Coach dreamscape portal"
      src={PORTAL_VIDEO_URL}
      autoPlay
      muted
      loop
      playsInline
      className="absolute inset-0 h-full w-full object-cover"
    />
  )
}

function Status({ status }: { status: ImmersiveStatus }) {
  const labels: Record<ImmersiveStatus, string> = {
    connecting: 'Connecting to the garden',
    attaching: 'Returning to the garden',
    creating: 'Creating the garden',
    streaming: 'Exploring live',
    ended: 'The journey has ended',
    fallback: 'Exploring the product gallery',
  }

  return (
    <p role="status" aria-live="polite" className="rounded-full border border-[#B3894F]/60 bg-black/65 px-4 py-2 text-xs uppercase tracking-[0.16em] text-[#F3EBDD] backdrop-blur">
      {labels[status]}
    </p>
  )
}

function Experience({ id, worldPromise, onViewProduct, onFallback }: ExperienceProps) {
  const {
    phase,
    streaming,
    attachWorld,
    createWorld,
    startTravel,
    disconnect,
    move,
    look,
    release,
    stop,
  } = useHappyOyster()
  const [status, setStatus] = useState<ImmersiveStatus>('connecting')
  const lifecycleStartedRef = useRef(false)
  const mountedRef = useRef(true)
  const startupTimeoutRef = useRef<number | null>(null)
  const disconnectPromiseRef = useRef<Promise<void> | null>(null)

  const disconnectOnce = useCallback(() => {
    if (!disconnectPromiseRef.current) {
      disconnectPromiseRef.current = disconnect().catch(() => undefined)
    }
    return disconnectPromiseRef.current
  }, [disconnect])

  const clearStartupTimeout = useCallback(() => {
    if (startupTimeoutRef.current === null) return
    window.clearTimeout(startupTimeoutRef.current)
    startupTimeoutRef.current = null
  }, [])

  const failToFallback = useCallback((reason: Exclude<FallbackReason, 'kill-switch'>) => {
    if (!mountedRef.current) return
    clearStartupTimeout()
    onFallback(reason, disconnectOnce())
  }, [clearStartupTimeout, disconnectOnce, onFallback])

  useHappyOysterTravelError(() => failToFallback('error'))

  useEffect(() => {
    startupTimeoutRef.current = window.setTimeout(
      () => failToFallback('timeout'),
      IMMERSIVE_STREAM_TIMEOUT_MS,
    )
    return () => {
      mountedRef.current = false
      clearStartupTimeout()
      void stop().catch(() => undefined)
      void disconnectOnce()
    }
  }, [clearStartupTimeout, disconnectOnce, failToFallback, stop])

  useEffect(() => {
    if (phase !== 'connected' || lifecycleStartedRef.current) return
    lifecycleStartedRef.current = true

    void (async () => {
      try {
        let savedWorldId: string | null = null
        try {
          const savedWorld = await worldPromise
          savedWorldId = savedWorld.world_id
        } catch {
          // Persistence must never prevent a temporary world from opening.
        }

        if (!mountedRef.current) return
        if (savedWorldId) {
          setStatus('attaching')
          await attachWorld(savedWorldId)
        } else {
          setStatus('creating')
          const world = await createWorld({
            prompt: IMMERSIVE_PROMPT,
            firstFrameImageUrl: WORLD_ANCHOR_URL,
            perspective: 'first_person',
          })
          if (world.encrypted_world_id) {
            void api.saveImmersiveWorld(world.encrypted_world_id).catch(() => undefined)
          }
        }

        if (!mountedRef.current) return
        const result = await startTravel()
        if (!result.streaming) throw new Error('HappyOyster did not open a live stream')
      } catch {
        failToFallback('error')
      }
    })()
  }, [attachWorld, createWorld, failToFallback, phase, startTravel, worldPromise])

  useEffect(() => {
    if (streaming || phase === 'ended') clearStartupTimeout()
    if (phase === 'failed') failToFallback('error')
  }, [clearStartupTimeout, failToFallback, phase, streaming])

  const displayedStatus: ImmersiveStatus = streaming
    ? 'streaming'
    : phase === 'ended'
      ? 'ended'
      : status

  const hold = (action: () => Promise<void>) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    void action().catch(() => failToFallback('error'))
  }
  const releaseAxis = (axis: 'translation' | 'rotation') => () => {
    void release({ [axis]: true }).catch(() => failToFallback('error'))
  }

  return (
    <section data-session-id={id} className="relative h-[100dvh] overflow-hidden bg-[#170b0d] text-[#F3EBDD]">
      <PortalBackground />
      <HappyOysterVideo
        aria-label="Live Coach courage garden"
        autoPlay
        muted
        playsInline
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${streaming ? 'opacity-100' : 'opacity-0'}`}
      />
      <div className="absolute inset-x-0 top-0 flex justify-center p-[max(1rem,env(safe-area-inset-top))]">
        <Status status={displayedStatus} />
      </div>
      <div className="absolute inset-x-0 bottom-0 space-y-3 bg-gradient-to-t from-black via-black/70 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-14">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            aria-label="Look left"
            disabled={!streaming}
            className={CONTROL_CLASS}
            onPointerDown={hold(() => look('Mouse_Left'))}
            onPointerUp={releaseAxis('rotation')}
            onPointerCancel={releaseAxis('rotation')}
            onLostPointerCapture={releaseAxis('rotation')}
          >
            Look left
          </button>
          <button
            type="button"
            aria-label="Walk into courage"
            disabled={!streaming}
            className={CONTROL_CLASS}
            onPointerDown={hold(() => move('Front'))}
            onPointerUp={releaseAxis('translation')}
            onPointerCancel={releaseAxis('translation')}
            onLostPointerCapture={releaseAxis('translation')}
          >
            Walk into courage
          </button>
          <button
            type="button"
            aria-label="Look right"
            disabled={!streaming}
            className={CONTROL_CLASS}
            onPointerDown={hold(() => look('Mouse_Right'))}
            onPointerUp={releaseAxis('rotation')}
            onPointerCancel={releaseAxis('rotation')}
            onLostPointerCapture={releaseAxis('rotation')}
          >
            Look right
          </button>
        </div>
        <ProductControls onViewProduct={onViewProduct} />
      </div>
    </section>
  )
}

function FallbackExperience({
  id,
  reason,
  retrying,
  onRetry,
  onViewProduct,
}: Omit<ImmersiveWorldProps, 'jwt' | 'worldPromise' | 'onRetryToken'> & {
  reason: FallbackReason
  retrying: boolean
  onRetry: () => void
}) {
  return (
    <section data-session-id={id} className="relative h-[100dvh] overflow-hidden bg-[#170b0d] text-[#F3EBDD]">
      <PortalBackground />
      <div className="absolute inset-x-0 top-0 flex flex-col items-center gap-3 p-[max(1rem,env(safe-area-inset-top))] text-center">
        <Status status="fallback" />
        <p className="max-w-sm rounded-2xl bg-black/60 px-4 py-3 text-sm backdrop-blur">
          The live garden is resting. The exact Tabby and Brooklyn views are still ready to explore.
        </p>
        {reason !== 'kill-switch' && (
          <button type="button" disabled={retrying} className={CONTROL_CLASS} onClick={onRetry}>
            {retrying ? 'Reconnecting…' : 'Retry live garden'}
          </button>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-20">
        <ProductControls onViewProduct={onViewProduct} />
      </div>
    </section>
  )
}

export default function ImmersiveWorld(props: ImmersiveWorldProps) {
  const [fallbackReason, setFallbackReason] = useState<FallbackReason | null>(() => {
    if (reactorKillSwitchEnabled()) return 'kill-switch'
    return props.jwt ? null : 'token'
  })
  const [providerKey, setProviderKey] = useState(0)
  const [retryJwt, setRetryJwt] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const pendingDisconnectRef = useRef<Promise<void>>(Promise.resolve())
  const retryInFlightRef = useRef(false)

  const enterFallback = useCallback((reason: Exclude<FallbackReason, 'kill-switch'>, disconnected: Promise<void>) => {
    pendingDisconnectRef.current = disconnected
    setFallbackReason(reason)
  }, [])

  const retry = async () => {
    if (retryInFlightRef.current) return
    retryInFlightRef.current = true
    setRetrying(true)
    await pendingDisconnectRef.current
    const freshJwt = await props.onRetryToken?.() ?? null
    if (freshJwt) {
      setRetryJwt(freshJwt)
      setFallbackReason(null)
      setProviderKey((key) => key + 1)
    }
    setRetrying(false)
    retryInFlightRef.current = false
  }

  const activeJwt = retryJwt ?? props.jwt

  if (fallbackReason || !activeJwt) {
    return (
      <FallbackExperience
        id={props.id}
        reason={fallbackReason ?? 'token'}
        retrying={retrying}
        onRetry={retry}
        onViewProduct={props.onViewProduct}
      />
    )
  }

  return (
    <HappyOysterProvider key={providerKey} mode="adventure" jwt={activeJwt} autoConnect>
      <Experience
        id={props.id}
        worldPromise={props.worldPromise}
        onFallback={enterFallback}
        onViewProduct={props.onViewProduct}
      />
    </HappyOysterProvider>
  )
}
