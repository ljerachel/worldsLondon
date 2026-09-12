# &Coach: Your London

Experiential playable ad — 5-hour hackathon build.

A Coach poster on the Tube carries a QR code. Scan it and you step into Coach's London:
a live-generated street in your neighbourhood (Reactor `lingbot-world-2`), walk to the
Coach store, see yourself wearing the look live (Reactor `x2`), and leave with a 9-second
"&Coach — {Name}'s chapter" film (Reactor `ltx2` — selfie + script → lip-synced
video+audio in one pass). The projector dashboard shows
a map of every visitor's London plus a deterministic Coach media plan. Backend runs on Modal.

Full build spec (timeline, contracts, per-builder tickets, demo script):
[COACH_LONDON_BUILD_SPEC.md](COACH_LONDON_BUILD_SPEC.md)

## Layout

```
frontend/          Vite + React + TypeScript + Tailwind, deployed on Vercel
  src/pages/       Qr.tsx (/) · Play.tsx (/play) · Dash.tsx (/dash)
  src/lib/         api.ts · world.ts (LingBot) · mirror.ts (X2)
  src/data/        config.ts — NEIGHBOURHOODS / CHAPTERS / BAGS
  public/looks/    look boards {bag}-{1..3}.png (pre-generated)
  public/neigh/    anchor stills {neigh}-{chapter}.png (pre-generated)
backend/           app.py (Modal FastAPI + modal.Dict + coach-files volume) · prompts.py · reactor_utils.py (Helios stills, LTX films) · gen_assets.py
RUNBOOK.md
```

## Quick start

Frontend:
```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL to the Modal URL
npm run dev
```

Backend:
```bash
cd backend
pip install -r requirements.txt
modal setup
modal secret create coach-secrets REACTOR_API_KEY='<reactor-key>' FRONTEND_ORIGIN='https://<vercel-url>'
modal deploy app.py    # or: modal serve app.py
```

Keys needed: `REACTOR_API_KEY` (covers Helios and LTX generation), plus Modal and Vercel accounts. `/api/insight` is deterministic and needs no model key.

Concept demo. Not affiliated with Coach / Tapestry.
