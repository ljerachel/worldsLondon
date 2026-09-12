# RUNBOOK — &Coach: Your London

## Deploy

Frontend (Vercel): import `frontend/` as the project root; set `VITE_API_URL` to the deployed Modal web URL. Auto-deploys on push to the configured production branch.

Backend (Modal 1.5.5), from the repository root:
```bash
python -m pip install -r backend/requirements.txt
modal setup
cd backend
modal secret create coach-secrets \
  REACTOR_API_KEY='<reactor-key>' \
  FRONTEND_ORIGIN='https://<vercel-url>' \
  SAMPLE_FILM_URL='https://<optional-backup-film-url>'
modal deploy app.py
```

`modal secret create` is a one-time command. If `coach-secrets` already exists, review it in Modal before intentionally updating it (the CLI requires `--force` to overwrite). The only generation credential is `REACTOR_API_KEY`; `/api/insight` is deterministic and requires no API key. For an ephemeral hot-reloading URL, run `cd backend && modal serve app.py` instead of deploying.

## Health and smoke checks

Set `BASE` to the URL printed by `modal deploy` or `modal serve`, without a trailing slash:
```bash
BASE='https://<modal-web-url>'
curl --fail-with-body "$BASE/api/health"
SESSION_ID="$(curl --fail-with-body -sS -X POST "$BASE/api/session" | python -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
curl --fail-with-body -sS -X POST "$BASE/api/answers" \
  -H 'content-type: application/json' \
  -d "{\"id\":\"$SESSION_ID\",\"name\":\"Demo\",\"neighbourhood\":\"soho\",\"chapter\":\"bignight\",\"bag\":\"brooklyn\"}"
curl --fail-with-body -sS -X POST "$BASE/api/insight"
curl --fail-with-body -sS "$BASE/api/state"
```

The insight response is always the same object with exactly `headline`, `reasoning`, `segments`, `media_plan`, and `localise`. The commands above do not invoke Reactor generation. Test `/api/localise` (Helios posters) and `/api/film` (LTX film) manually only when spending Reactor credits is intended.

## Seed and reset

```bash
curl --fail-with-body -X POST "$BASE/api/seed" \
  -H 'content-type: application/json' -d '{"n":20}'
curl --fail-with-body -X POST "$BASE/api/reset"
```

`POST /api/reset` clears all sessions (dashboard hotkey `C`, asks for confirmation). `POST /api/seed` fills the dashboard with demo sessions (dashboard hotkey `S`).

## Kill switches

- Phone, in devtools console or via a `?noreactor` flow: `localStorage.coach_no_reactor = "1"` makes Play use the anchor still + parallax instead of LingBot and webcam + look-board PiP instead of X2.
- Keep `SAMPLE_FILM_URL` set to a rehearsed LTX result so film failures have a fallback.

## Reactor probe and assets

Use a scratch directory outside this repository for frontend model probes:
```bash
npx create-reactor-app reactor-probe --model=lingbot-world-2
```
Run it with `REACTOR_API_KEY` only when a live credit-spending probe is intended. Model schemas are at `https://docs.reactor.inc/model-api-reference/lingbot-world-2/schema` and `https://docs.reactor.inc/model-api-reference/x2/schema`.

Generate anchor stills and look boards through Reactor Helios, from the repository root:
```bash
cd backend
REACTOR_API_KEY='<reactor-key>' python gen_assets.py --quick
```
Omit `--quick` for all 30 neighbourhood/chapter anchors. Generated static assets go to `frontend/public/neigh/` and `frontend/public/looks/`.

## Generated files

Selfies, LTX films, and Helios posters live on the Modal volume `coach-files` and are served at `GET /api/files/{path}`. Inspect without modifying it:
```bash
modal volume ls coach-files /
```
Films land at `/api/files/films/{session_id}.mp4`; posters land under `/api/files/posters/`.

## Demo-day settings

- `min_containers=1` is set on `fastapi_app`; keep it for demo hour.
- Use a hotspot as backup for venue Wi-Fi. Vercel and Modal front the two applications.
- Rehearse one stock-portrait LTX film and set its URL as `SAMPLE_FILM_URL`; seeds and failed live films use it.
- The dashboard strategy and `/api/insight` are deterministic. “Generate localised posters” is the only dashboard action that invokes Reactor, through Helios.
- Recorded full-flow backup video: `content/backup.mp4`; keep a copy on a phone and USB.
