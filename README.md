# &Coach: Your London

Experiential playable ad — 5-hour hackathon build.

A Coach poster on the Tube carries a QR code. Scan it and you step into Coach's London:
a live-generated street in your neighbourhood (Reactor `lingbot-world-2`), walk to the
Coach store, see yourself wearing the look live (Reactor `x2`), and leave with a 9-second
"&Coach — {Name}'s chapter" film (VEED Fabric via fal.ai). The projector dashboard shows
a map of every visitor's London plus an AI-reasoned media plan. Backend runs on Modal.

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
backend/           app.py (Modal FastAPI + modal.Dict) · prompts.py · gen_assets.py
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
modal secret create coach-secrets REACTOR_API_KEY=... FAL_KEY=... OPENAI_API_KEY=... FRONTEND_ORIGIN=https://<vercel-url>
modal deploy app.py    # or: modal serve app.py
```

Keys needed: `REACTOR_API_KEY` (rk_…), `FAL_KEY`, `OPENAI_API_KEY`, Modal + Vercel accounts.

Concept demo. Not affiliated with Coach / Tapestry.
