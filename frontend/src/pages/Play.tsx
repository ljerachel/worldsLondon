import { COACH } from '../data/config'

// TODO (Builder A — tickets T5/T7 in the build spec):
// Screen 1: "Tap to enter Coach's London" -> POST /api/session, gyro permission, prefetch Reactor JWT
// Screen 2: 3 questions (neighbourhood / chapter / bag) + optional name -> POST /api/answers
// Screen 3: street via openWorld() (lib/world.ts); tilt-look, hold-to-walk, "Enter Coach" chip
// Screen 4: <Mirror /> (Builder C) — X2 try-on
// Screen 5: "Your chapter" — pick line -> POST /api/film -> poll session -> play film_url; share + CTA
export default function Play() {
  return (
    <div
      className="h-[100dvh] overflow-hidden touch-none flex items-center justify-center"
      style={{ backgroundColor: COACH.black, color: COACH.cream }}
    >
      <h1 className="font-serif text-4xl">Tap to enter Coach's London</h1>
    </div>
  )
}
