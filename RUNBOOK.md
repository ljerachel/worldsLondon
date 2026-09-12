# RUNBOOK — &Coach: Your London

## Deploy

Frontend (Vercel): import `frontend/` as the project root; set env `VITE_API_URL=<modal url>`. Auto-deploys on push to main.

Backend (Modal):
```bash
pip install -r backend/requirements.txt
modal setup
modal secret create coach-secrets \
  REACTOR_API_KEY=rk_... FAL_KEY=... OPENAI_API_KEY=... \
  FRONTEND_ORIGIN=https://<vercel-url> SAMPLE_FILM_URL=https://...
modal deploy backend/app.py        # production URL
modal serve backend/app.py         # ephemeral dev URL (changes on restart!)
```

## Health check
`GET <modal url>/api/health` → `{"ok": true}`. Then `POST /api/session` from a laptop, and from a phone hit `https://<vercel>/play`.

## Kill switches
- Phone, in devtools console or via a "?noreactor" flow: `localStorage.coach_no_reactor = "1"` → Play uses the anchor still + parallax instead of LingBot, and webcam + look-board PiP instead of X2.
- `POST /api/reset` clears all sessions (dashboard hotkey `C`, asks for confirm).
- `POST /api/seed {"n":20}` fills the dashboard (hotkey `S`).

## Reactor probe
```
npx create-reactor-app reactor-probe --model=lingbot-world-2
```
Run with `REACTOR_API_KEY` to verify video lands before wiring `/play`. Schemas:
`docs.reactor.inc/model-api-reference/lingbot-world-2/schema.md` and `.../x2/schema.md`.

## Backup video
Recorded full-flow video lives in `content/backup.mp4` (create during rehearsal at 4:00).
Keep a copy on a phone + USB.

## Demo-day settings
- `min_containers=1` is already set on `fastapi_app` — keep it for demo hour.
- Hotspot as backup for venue wifi. Both Vercel and Modal are CDN-fronted.
- `SAMPLE_FILM_URL`: pre-generate one VEED Fabric film with a stock portrait; also used for seeds + failures.
