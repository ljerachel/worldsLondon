import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { PRODUCTS } from '../data/products'
import type { ProductKey } from '../data/products'

const MIN_SCALE = 1
const MAX_SCALE = 4
const SCALE_STEP = 0.5

type Transform = {
  scale: number
  x: number
  y: number
}

type Point = {
  x: number
  y: number
}

export interface ProductInspectorProps {
  initialProduct: ProductKey
  onView: (product: ProductKey) => void
  onSelect: (product: ProductKey) => void
  onClose: () => void
}

const INITIAL_TRANSFORM: Transform = { scale: MIN_SCALE, x: 0, y: 0 }

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function pointerDistance(points: Point[]) {
  const [first, second] = points
  if (!first || !second) return null
  return Math.hypot(second.x - first.x, second.y - first.y)
}

export default function ProductInspector({ initialProduct, onView, onSelect, onClose }: ProductInspectorProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const pointersRef = useRef(new Map<number, Point>())
  const pinchDistanceRef = useRef<number | null>(null)
  const [product, setProduct] = useState<ProductKey>(initialProduct)
  const [transform, setTransform] = useState<Transform>(INITIAL_TRANSFORM)
  const [imageAvailable, setImageAvailable] = useState(true)
  const details = PRODUCTS[product]

  const constrain = (next: Transform): Transform => {
    const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE)
    if (scale === MIN_SCALE) return INITIAL_TRANSFORM

    const width = viewportRef.current?.clientWidth ?? 0
    const height = viewportRef.current?.clientHeight ?? 0
    const maxX = width * (scale - 1) / 2
    const maxY = height * (scale - 1) / 2
    return {
      scale,
      x: width > 0 ? clamp(next.x, -maxX, maxX) : next.x,
      y: height > 0 ? clamp(next.y, -maxY, maxY) : next.y,
    }
  }

  const clearGesture = () => {
    pointersRef.current.clear()
    pinchDistanceRef.current = null
  }

  const resetTransform = () => {
    clearGesture()
    setTransform(INITIAL_TRANSFORM)
  }

  const changeScale = (amount: number) => {
    setTransform((current) => constrain({ ...current, scale: current.scale + amount }))
  }

  const viewProduct = (nextProduct: ProductKey) => {
    if (nextProduct === product) return
    setProduct(nextProduct)
    setImageAvailable(true)
    resetTransform()
    onView(nextProduct)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const point = { x: event.clientX, y: event.clientY }
    pointersRef.current.set(event.pointerId, point)
    pinchDistanceRef.current = pointerDistance([...pointersRef.current.values()])
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return

    const point = { x: event.clientX, y: event.clientY }
    const previous = pointersRef.current.get(event.pointerId)
    pointersRef.current.set(event.pointerId, point)

    if (pointersRef.current.size > 1) {
      const distance = pointerDistance([...pointersRef.current.values()])
      const previousDistance = pinchDistanceRef.current
      if (distance !== null && previousDistance !== null && previousDistance > 0) {
        setTransform((current) => constrain({
          ...current,
          scale: current.scale * distance / previousDistance,
        }))
      }
      pinchDistanceRef.current = distance
      return
    }

    if (transform.scale > MIN_SCALE && previous) {
      setTransform((current) => constrain({
        ...current,
        x: current.x + point.x - previous.x,
        y: current.y + point.y - previous.y,
      }))
    }
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId)
    const remaining = [...pointersRef.current.values()]
    pinchDistanceRef.current = pointerDistance(remaining)
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (event.deltaY === 0) return
    changeScale(event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP)
  }

  const controlClass = 'min-h-14 min-w-14 rounded-full border border-[#B3894F]/75 bg-black/70 px-4 text-sm font-medium text-[#F3EBDD] backdrop-blur transition active:scale-95 disabled:opacity-40'

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-inspector-title"
      className="fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-[#0d0b09] text-[#F3EBDD]"
    >
      <header className="flex items-center justify-between gap-4 px-5 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#B3894F]">Exact product close-up</p>
          <h1 id="product-inspector-title" className="mt-1 font-serif text-3xl">{details.label}</h1>
        </div>
        <button type="button" aria-label="Close product view" onClick={onClose} className={controlClass}>
          <span aria-hidden="true" className="text-2xl leading-none">×</span>
        </button>
      </header>

      <div
        ref={viewportRef}
        aria-label={`${details.label} image viewer`}
        className={`relative mx-4 min-h-0 flex-1 overflow-hidden rounded-[2rem] border border-[#B3894F]/45 bg-[#21170f] ${transform.scale > MIN_SCALE ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        onWheel={handleWheel}
      >
        <div
          data-testid="product-transform"
          className="flex h-full w-full items-center justify-center will-change-transform"
          style={{ transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})` }}
        >
          {imageAvailable ? (
            <img
              key={product}
              src={details.imageUrl}
              alt={`${details.label} close-up`}
              draggable="false"
              onError={() => setImageAvailable(false)}
              className="h-full w-full select-none object-contain"
            />
          ) : (
            <div
              role="img"
              aria-label={`${details.label} close-up unavailable`}
              className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_center,#6e422d,#120e0b_70%)] p-8 text-center"
            >
              <span aria-hidden="true" className="font-serif text-7xl text-[#B3894F]">C</span>
              <p className="mt-4 font-serif text-2xl">Coach {details.label}</p>
              <p className="mt-2 max-w-xs text-xs uppercase tracking-[0.18em] text-[#F3EBDD]/65">Product image temporarily unavailable</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mb-3 grid grid-cols-4 gap-2">
          <button type="button" aria-label="Zoom out" disabled={transform.scale <= MIN_SCALE} onClick={() => changeScale(-SCALE_STEP)} className={controlClass}>−</button>
          <div aria-live="polite" aria-label={`Zoom ${transform.scale.toFixed(1)} times`} className="flex min-h-14 items-center justify-center rounded-full border border-white/20 bg-white/5 text-sm tabular-nums">
            {transform.scale.toFixed(1)}×
          </div>
          <button type="button" aria-label="Zoom in" disabled={transform.scale >= MAX_SCALE} onClick={() => changeScale(SCALE_STEP)} className={controlClass}>+</button>
          <button type="button" aria-label="Reset product view" onClick={resetTransform} className={controlClass}>Reset</button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          {(Object.keys(PRODUCTS) as ProductKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-label={`View ${PRODUCTS[key].label}`}
              aria-pressed={product === key}
              onClick={() => viewProduct(key)}
              className={`${controlClass} ${product === key ? 'border-[#F3EBDD] bg-[#B3894F] text-black' : ''}`}
            >
              {PRODUCTS[key].label}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-label={`Choose ${details.label}`}
          onClick={() => onSelect(product)}
          className="min-h-14 w-full rounded-full bg-[#F3EBDD] px-6 text-sm font-semibold uppercase tracking-[0.18em] text-[#0d0b09] transition active:scale-[0.98]"
        >
          Choose {details.label}
        </button>
      </div>
    </section>
  )
}
