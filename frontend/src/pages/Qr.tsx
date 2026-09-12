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
      className="h-[100dvh] flex flex-col items-center justify-center gap-10"
      style={{ backgroundColor: COACH.cream, color: COACH.black }}
    >
      <h1 className="font-serif text-6xl text-center px-8">
        &amp;Coach — Your London
      </h1>
      <p className="text-xl opacity-70">Scan to step into Coach's London</p>
      <div className="bg-white p-6 rounded-sm shadow-2xl border" style={{ borderColor: COACH.tan }}>
        <QRCodeSVG value={playUrl} size={480} fgColor={COACH.black} />
      </div>
      <p className="text-lg" style={{ color: COACH.tan }}>{playUrl}</p>
      <p className="absolute bottom-4 text-xs opacity-40">
        Concept demo. Not affiliated with Coach / Tapestry.
      </p>
    </div>
  )
}
