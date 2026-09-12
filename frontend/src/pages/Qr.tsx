import { QRCodeSVG } from 'qrcode.react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { COACH } from '../data/config'

export default function Qr() {
  const navigate = useNavigate()
  const playUrl = `${window.location.origin}/play`

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'd') navigate('/dash')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 py-8"
      style={{ backgroundColor: COACH.cream, color: COACH.black }}
    >
      <h1 className="font-serif text-4xl md:text-6xl text-center px-8">
        &amp;Coach — Your London
      </h1>
      <p className="text-lg md:text-xl opacity-70">Scan to step into Coach's London</p>
      <div className="bg-white p-4 md:p-6 rounded-sm shadow-2xl border" style={{ borderColor: COACH.tan }}>
        <QRCodeSVG
          value={playUrl}
          fgColor={COACH.black}
          style={{ width: 'min(480px, 60vw, 45vh)', height: 'auto' }}
        />
      </div>
      <p className="text-base md:text-lg" style={{ color: COACH.tan }}>{playUrl}</p>
      <p className="mt-2 text-xs opacity-40">
        Concept demo. Not affiliated with Coach / Tapestry.
      </p>
    </div>
  )
}
