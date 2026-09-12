import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Session } from '../lib/api'
import { COACH } from '../data/config'

// TODO (Builder C — ticket T8): London map SVG (6 zones from NEIGHBOURHOODS) with
// tan pulses per visitor, counters (scans/walking/in_store/tryons/saves/films/shares/
// reservations), visitor list, look wall (selfie_url thumbs -> film modal),
// insight panel (hotkey I, typewriter reasoning -> /api/localise posters rail),
// hotkeys S seed / C reset / I insight / F fullscreen.
export default function Dash() {
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    const tick = () =>
      api
        .getState()
        .then((s) => setSessions(s.sessions))
        .catch(() => {})
    tick()
    const t = setInterval(tick, 1500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="h-[100dvh] p-8" style={{ backgroundColor: '#0b0b0f', color: COACH.cream }}>
      <h1 className="font-serif text-4xl" style={{ color: COACH.tan }}>
        &amp;Coach — {sessions.length} visitors, {sessions.length} Londons
      </h1>
      <pre className="mt-8 text-sm opacity-70 overflow-auto">
        {JSON.stringify(sessions, null, 2)}
      </pre>
    </div>
  )
}
