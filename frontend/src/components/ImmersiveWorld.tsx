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
import {
  IMMERSIVE_PROMPT,
  IMMERSIVE_STREAM_TIMEOUT_MS,
  reactorKillSwitchEnabled,
} from '../lib/immersive'
import type { ImmersiveStatus } from '../lib/immersive'

export interface ImmersiveWorldProps {
  id: string
  jwt: string
  onViewProduct: (product: ProductKey) => void
  onSelectProduct: (product: ProductKey) => void
}

type FallbackReason = 'kill-switch' | 'timeout' | 'error'

type ExperienceProps = Omit<ImmersiveWorldProps, 'jwt'> & {
  onFallback: (
    reason: Exclude<FallbackReason, 'kill-switch'>,
    disconnected: Promise<void>,
  ) => void
}

const CONTROL_CLASS = 'min-h-14 rounded-full border border-[#F3EBDD]/45 bg-black/65 px-4 text-sm font-semibold text-[#F3EBDD] shadow-lg backdrop-blur transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40'

function ProductControls({
  onViewProduct,
  onSelectProduct,
}: Pick<ImmersiveWorldProps, 'onViewProduct' | 'onSelectProduct'>) {
  return (
    <div className="grid grid-cols-2 gap-2" aria-label="Product plinths">
      {(Object.keys(PRODUCTS) as ProductKey[]).map((product) => (
        <div key={product} className="grid gap-2 rounded-[1.5rem] border border-[#B3894F]/55 bg-black/55 p-2 backdrop-blur">
          <button
            type="button"
            className={CONTROL_CLASS}
            onClick={() => onViewProduct(product)}
          >
            Explore {PRODUCTS[product].label}
          </button>
          <button
            type="button"
            className="min-h-14 rounded-full bg-[#F3EBDD] px-4 text-sm font-semibold text-[#160d0b] transition active:scale-95"
            onClick={() => onSelectProduct(product)}
          >
            Choose {PRODUCTS[product].label}
          </button>
        </div>
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

function Experience({ id, onViewProduct, onSelectProduct, onFallback }: ExperienceProps) {
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
  const disconnectPromiseRef = useRef<Promise<void> | null>(null)

  const disconnectOnce = useCallback(() => {
    if (!disconnectPromiseRef.current) {
      disconnectPromiseRef.current = disconnect().catch(() => undefined)
    }
    return disconnectPromiseRef.current
  }, [disconnect])

  const failToFallback = useCallback((reason: Exclude<FallbackReason, 'kill-switch'>) => {
    if (!mountedRef.current) return
    onFallback(reason, disconnectOnce())
  }, [disconnectOnce, onFallback])

  useHappyOysterTravelError(() => failToFallback('error'))

  useEffect(() => {
    return () => {
      mountedRef.current = false
      void stop().catch(() => undefined)
      void disconnectOnce()
    }
  }, [disconnectOnce, stop])

  useEffect(() => {
    if (phase !== 'connected' || lifecycleStartedRef.current) return
    lifecycleStartedRef.current = true

    void (async () => {
      try {
        let savedWorldId: string | null = null
        try {
          const savedWorld = await api.getImmersiveWorld()
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
  }, [attachWorld, createWorld, failToFallback, phase, startTravel])

  useEffect(() => {
    if (phase === 'failed') failToFallback('error')
  }, [failToFallback, phase])

  const displayedStatus: ImmersiveStatus = streaming
    ? 'streaming'
    : phase === 'ended'
      ? 'ended'
      : status

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!streaming) failToFallback('timeout')
    }, IMMERSIVE_STREAM_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [failToFallback, streaming])

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
        <ProductControls onViewProduct={onViewProduct} onSelectProduct={onSelectProduct} />
      </div>
    </section>
  )
}

function FallbackExperience({
  id,
  reason,
  onRetry,
  onViewProduct,
  onSelectProduct,
}: Omit<ImmersiveWorldProps, 'jwt'> & { reason: FallbackReason; onRetry: () => void }) {
  return (
    <section data-session-id={id} className="relative h-[100dvh] overflow-hidden bg-[#170b0d] text-[#F3EBDD]">
      <PortalBackground />
      <div className="absolute inset-x-0 top-0 flex flex-col items-center gap-3 p-[max(1rem,env(safe-area-inset-top))] text-center">
        <Status status="fallback" />
        <p className="max-w-sm rounded-2xl bg-black/60 px-4 py-3 text-sm backdrop-blur">
          The live garden is resting. The exact Tabby and Brooklyn views are still ready to explore.
        </p>
        {reason !== 'kill-switch' && (
          <button type="button" className={CONTROL_CLASS} onClick={onRetry}>Retry live garden</button>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-20">
        <ProductControls onViewProduct={onViewProduct} onSelectProduct={onSelectProduct} />
      </div>
    </section>
  )
}

export default function ImmersiveWorld(props: ImmersiveWorldProps) {
  const [fallbackReason, setFallbackReason] = useState<FallbackReason | null>(() => (
    reactorKillSwitchEnabled() ? 'kill-switch' : null
  ))
  const [providerKey, setProviderKey] = useState(0)
  const pendingDisconnectRef = useRef<Promise<void>>(Promise.resolve())

  const enterFallback = useCallback((reason: Exclude<FallbackReason, 'kill-switch'>, disconnected: Promise<void>) => {
    pendingDisconnectRef.current = disconnected
    setFallbackReason(reason)
  }, [])

  const retry = async () => {
    await pendingDisconnectRef.current
    setFallbackReason(null)
    setProviderKey((key) => key + 1)
  }

  if (fallbackReason) {
    return (
      <FallbackExperience
        id={props.id}
        reason={fallbackReason}
        onRetry={retry}
        onViewProduct={props.onViewProduct}
        onSelectProduct={props.onSelectProduct}
      />
    )
  }

  return (
    <HappyOysterProvider key={providerKey} mode="adventure" jwt={props.jwt} autoConnect>
      <Experience
        id={props.id}
        onFallback={enterFallback}
        onViewProduct={props.onViewProduct}
        onSelectProduct={props.onSelectProduct}
      />
    </HappyOysterProvider>
  )
}
