# &COACH: YOUR LONDON — Experiential playable ad · Build Spec (5 hours, 3 builders + coding agents)

## The idea
A Coach poster on the Tube has a QR code. Scan it and you don't see an ad — you step into Coach's London: a live-generated street in your part of the city, in the look of Coach's current campaign, and you walk to the Coach store. Inside, the camera flips: you see yourself wearing the look, live. You leave with a 9-second "&Coach — {Name}'s chapter" film about you, and Coach learns which look, which London and which story you chose.

Why Coach: their live platform is &Coach (June 2026) — "confidence without conformity", Gen Z co-creation, bags as "companions in moments of transition", and Spring '26 "Explore Your Story" (Tabby bag, storytelling, Courage to Be Real). City-life, first-big-opportunity, night-before-something-new energy. We literally let the customer author their own chapter — the exact thing the campaign promises but a poster can't deliver.

Pitch opener: "Coach's new campaign is called &Coach. The 'and' is you. But a poster can't fit you in. Scan this." Closer: "The poster used to be the end of the ad. Now it's the door."

## Sponsors, load-bearing
- **Reactor** — two models:
  - `reactor/lingbot-world-2`: image-anchored navigable world (WASD move + look + live prompt). The London street you walk through.
  - `reactor/x2`: live reference-guided video transformation (webcam in → re-rendered out, with `set_reference_image` for clothing/character). The in-store try-on mirror.
- **Reactor LTX** (`reactor/ltx2`, photo + script → lip-synced talking video with joint audio, one pass — no separate TTS) — the personalised "&Coach — {Name}'s chapter" film: the customer's own selfie (or their London scene) speaks their chapter line. All media generation runs on Reactor credits.
- **Modal** — the whole backend: FastAPI via `@modal.asgi_app()`, state in `modal.Dict`, background generation jobs, secrets.

## The customer's 90 seconds (phone)
Scan → black screen, Coach "C" glow, "Tap to enter Coach's London". (Gesture unlocks audio, camera + gyro permissions requested later at the right moment.)

Three taps (15s) — personalisation, in &Coach's language:
- "Where's your London?" → Shoreditch · Soho · Notting Hill · Camden · South Bank · Peckham
- "What's the next chapter?" → First day · Big night · Quiet Sunday · Leaving town · Meeting someone
- "Pick your companion" → Tabby · Brooklyn · Empire (3 bag silhouettes)
- Optional: first name.

The street (30s) — LingBot World 2 anchored on a generated still (Helios frame grab) of their neighbourhood at golden hour/night in Coach's palette (tan leather, warm reds, grainy 35mm). Tilt phone to look, thumb-joystick/swipe to walk. Ahead down the street: a Coach storefront glow. Campaign-style text drifts in: "First day. Coach & you." Persistent prompt steering adds their chapter's mood.

The store (30s) — as they approach (or after 25s, or "Enter" button), the screen flips to the mirror: front camera → Reactor X2 with `set_reference_image` = a Coach look board (their bag + campaign outfit). They see themselves wearing it, live. Swipe → next look (3 looks pre-built per bag). Tap ♥ to save.

Your chapter (15s) — "Say your line" — tap one of 3 lines or type → Reactor LTX animates their selfie (grabbed from the mirror) saying it; text lockup "&Coach · {Name}, {Neighbourhood}". Share sheet, and CTA: "Reserve the Tabby at Coach Regent Street" / "Send to a friend".

## The room (projector `/dash`)
- Map of London with a Coach-tan pulse per visitor in their neighbourhood; live counters: scans · walking · in store · try-ons · saves · chapters made · shares · reservations.
- Look wall: each visitor's mirror still, name, neighbourhood, chapter, bag. Click → their chapter film full-screen.
- Strategy panel: the deterministic Coach strategist types out 4 reasoning steps → headline, media plan, neighbourhoods to localise → "Generate" → Reactor Helios stills of localised posters appear in a "Ready to ship" rail.

## Why each judge cares
- **Seva (world models @ Wayve)**: a navigable generated London, conditioned on 3 answers, that the user walks through. "A world model with a shop in it."
- **Davide (Reactor)**: two Reactor models in one flow — LingBot World 2 for navigation, X2 for live try-on. Latency badge on screen.
- **Jake (Multic)**: every visitor leaves with a 9s vertical film starring themselves = &Coach's "shared authorship" made real; a UGC engine creators can clip.
- **Chengxi (General Reasoning)**: the dashboard reasons from behaviour to a media + creative plan and generates the localised posters.

## 0. Stack (final — do not change)
| Layer | Choice |
|---|---|
| Frontend | Vite + React + TS + Tailwind, deployed on Vercel (static SPA; public HTTPS needed for camera/gyro/QR) |
| Backend | Modal: `backend/app.py` FastAPI via `@modal.asgi_app()`, `min_containers=1` during demo |
| State | `modal.Dict.from_name("coach-state", create_if_missing=True)` — no DB |
| Realtime | Polling: dashboard `GET /api/state` every 1.5s; phone polls its session for `film_url` |
| Live world | `@reactor-team/js-sdk`, `reactor/lingbot-world-2` (needs `set_image` + `set_prompt` before `start`) |
| Live try-on | `@reactor-team/js-sdk`, `reactor/x2` — publish webcam to inbound track `source` (SDK `WebcamStream track="source"`), `set_reference_image`, `set_prompt`; render `main_video` |
| Reactor auth | Modal `POST /api/reactor-token` → `POST https://api.reactor.inc/tokens` header `Reactor-API-Key` → `{jwt}` |
| Generation | Reactor Python `reactor-sdk` on Modal: `reactor/helios` frame grabs (neighbourhood stills, look boards, posters), `reactor/ltx2` (film: avatar photo + script → video+audio in one pass). Output files stored on `modal.Volume` `coach-files`, served via `GET /api/files/{path}` |
| Strategy | Deterministic Coach response shared by the dashboard and `POST /api/insight`; no model key or runtime call |
| QR / Map / Motion | `qrcode.react`, a static SVG of London boroughs (hand-drawn 6 zones is fine) or `react-simple-maps` with a London geojson, `framer-motion` |

Fast path for Reactor boilerplate: `npx create-reactor-app reactor-probe --model=lingbot-world-2` in a scratch folder and copy its auth + video wiring. Typed SDKs exist as `@reactor-models/<model>` (e.g. `useLingbotWorld2()`), but the base `Reactor` class + `sendCommand` is enough and works for both models.

Repo layout:
```
coach-london/
  frontend/
    src/pages/Qr.tsx        # "/"        projector QR
    src/pages/Play.tsx      # "/play"    phone experience (5 screens)
    src/pages/Dash.tsx      # "/dash"    projector dashboard
    src/lib/api.ts          # fetch wrapper, BASE = import.meta.env.VITE_API_URL
    src/lib/world.ts        # LingBot World 2 helper
    src/lib/mirror.ts       # X2 helper
    src/data/config.ts      # neighbourhoods, chapters, bags, lines (static)
    public/looks/*.png      # 9 look boards (3 bags × 3 looks), pre-generated
    public/neigh/*.png      # 6 neighbourhood anchor stills, pre-generated
  backend/app.py, prompts.py, requirements.txt
  RUNBOOK.md
```

Access to collect at minute 0: `REACTOR_API_KEY` for Reactor media generation; Modal account (`pip install modal && modal setup`); Vercel account. The deterministic strategy requires no model API key.

## 1. Shared contracts (everyone codes against these)

### Static config (`frontend/src/data/config.ts`, mirrored in `backend/prompts.py`)
```ts
export const NEIGHBOURHOODS = {
  shoreditch: { label: "Shoreditch", lat: 51.5246, lng: -0.0776, cue: "brick warehouses, street art, neon signs" },
  soho:       { label: "Soho",       lat: 51.5136, lng: -0.1365, cue: "narrow streets, theatre marquees, red lanterns, bars" },
  notting:    { label: "Notting Hill", lat: 51.5090, lng: -0.1963, cue: "pastel terraces, antique shopfronts, market stalls" },
  camden:     { label: "Camden",     lat: 51.5390, lng: -0.1426, cue: "canal lock, market, punk shopfronts, bridges" },
  southbank:  { label: "South Bank", lat: 51.5066, lng: -0.1146, cue: "riverside promenade, skateboarders, brutalist concrete, Thames" },
  peckham:    { label: "Peckham",    lat: 51.4739, lng: -0.0692, cue: "rooftop bar, rye lane shopfronts, buses, sunset" },
};
export const CHAPTERS = {
  firstday: { label: "First day", mood: "early morning golden light, empty streets, hopeful" , line: "Tomorrow's the first day. I'm ready." },
  bignight: { label: "Big night", mood: "night, wet streets reflecting neon, buzzing", line: "Tonight I'm not asking permission." },
  sunday:   { label: "Quiet Sunday", mood: "soft overcast light, coffee cups, slow", line: "No plans. That's the plan." },
  leaving:  { label: "Leaving town", mood: "dusk, taxi headlights, suitcase, bittersweet", line: "Some chapters you close on purpose." },
  meeting:  { label: "Meeting someone", mood: "blue hour, warm windows, anticipation", line: "Ten minutes early. Heart already there." },
};
export const BAGS = { tabby: "Tabby", brooklyn: "Brooklyn", empire: "Empire" };  // 3 looks each: /looks/{bag}-{1..3}.png
```

### Session (Dict key `session:{id}`)
```json
{ "id":"k3j9", "name":"Seva", "neighbourhood":"soho", "chapter":"bignight", "bag":"brooklyn",
  "street_prompt":"…", "anchor_url":"/neigh/soho-bignight.png",
  "step":"opened",
  "look_index":0, "saved_looks":[], "selfie_url":null,
  "line":"Tonight I'm not asking permission.",
  "film_status":"none", "film_url":null,
  "shared":false, "cta":null,
  "walk_ms":0, "store_ms":0, "created_at":0 }
```
step: opened | questions | street | store | film | done — film_status: none | pending | ready | failed — cta: null | "reserve" | "send"

### Endpoints (Modal FastAPI, JSON, CORS `*`)
| Method | Path | In → Out |
|---|---|---|
| POST | `/api/session` | `{}` → `{id}` |
| POST | `/api/answers` | `{id,name,neighbourhood,chapter,bag}` → session with `street_prompt`, `anchor_url`, `line` |
| POST | `/api/event` | `{id,type,value?}` → `{ok}`. Types: `street_enter, walk(ms), store_enter, look(index), save(index), selfie(url), line(text), share, cta(reserve|send), drop` |
| POST | `/api/selfie` | multipart `{id, file}` → stored on `coach-files` volume → `{selfie_url}` (saved on session) |
| POST | `/api/film` | `{id}` → `{film_status:"pending"}`; spawns `make_film(id)` |
| POST | `/api/reactor-token` | `{}` → `{jwt}` |
| GET | `/api/session/{id}` | → session |
| GET | `/api/state` | → `{sessions:[…], counts:{scans,walking,in_store,tryons,saves,films,shares,reservations}}` |
| POST | `/api/insight` | `{}` → `{headline, reasoning[], segments[], media_plan[], localise[]}` |
| POST | `/api/localise` | `{neighbourhoods:[…], bag, chapter}` → `{posters:[{neighbourhood,url}]}` (Helios stills) |
| GET | `/api/files/{path}` | serves generated files (selfies, films, posters) from the `coach-files` volume |
| POST | `/api/seed` `{n}` · POST `/api/reset` | |

### Reactor command cheat-sheet

**LingBot World 2 (`reactor/lingbot-world-2`) — the street**
```ts
const r = new Reactor({ modelName: "reactor/lingbot-world-2" });
r.on("trackReceived", (name, track) => { if (name==="main_video") { video.srcObject = new MediaStream([track]); video.play(); }});
await r.connect(jwt);                                   // wait statusChanged==="ready"
const ref = await r.uploadFile(anchorPngFile);          // fetch(anchor_url) → File
await r.sendCommand("set_image", { image: ref });       // REQUIRED before start
await r.sendCommand("set_prompt", { prompt: street_prompt });
await r.sendCommand("start", {});
// steering (persistent until changed; send "idle" to stop)
r.sendCommand("set_move_longitudinal", { move_longitudinal: "forward" | "back" | "idle" });
r.sendCommand("set_move_lateral",      { move_lateral: "strafe_left" | "strafe_right" | "idle" });
r.sendCommand("set_look_horizontal",   { look_horizontal: "<see schema page: left/right/idle>" });
r.sendCommand("set_prompt", { prompt: street_prompt + ", a glowing Coach storefront ahead" }); // hot-swap
```

**X2 (`reactor/x2`) — the mirror**
```tsx
<ReactorProvider modelName="reactor/x2" jwtToken={jwt} connectOptions={{autoConnect:true}}>
  <WebcamStream track="source" showWebcam={false} videoConstraints={{ facingMode: "user", width: 720, height: 1280 }} />
  <ReactorView track="main_video" videoObjectFit="cover" className="h-full w-full" />
</ReactorProvider>
// on ready:
const ref = await uploadFile(lookBoardPng);
await sendCommand("set_reference_image", { reference_image: ref });
await sendCommand("set_prompt", { prompt: "dress the person in the video in the outfit and bag from the reference image, keep their face and pose, Coach campaign lighting" });
// swipe → set_reference_image(nextLook)  (auto-restarts stream)
```

Check exact enum values for `set_look_horizontal` at docs.reactor.inc/model-api-reference/lingbot-world-2/schema (append `.md`). X2 track/schema at `/model-api-reference/x2/schema.md`.

## 2. Timeline

### 0:00 – 0:25 · ALL THREE (nothing else until every box is ticked)
- [ ] Vite app → GitHub → Vercel → open `https://<vercel>/play` on a phone.
- [ ] Modal hello world (below) deployed; `frontend/.env` + Vercel env `VITE_API_URL=<modal url>`; phone shows `/api/health` OK.
```python
import modal, os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
app = modal.App("coach-london")
image = modal.Image.debian_slim().pip_install("fastapi[standard]", "reactor-sdk==1.5.1", "httpx", "python-multipart", "numpy", "Pillow")
state = modal.Dict.from_name("coach-state", create_if_missing=True)
web = FastAPI(); web.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
@web.get("/api/health")
def health(): return {"ok": True}
@app.function(image=image, secrets=[modal.Secret.from_name("coach-secrets")], min_containers=1)
@modal.asgi_app()
def fastapi_app(): return web
```
From `backend/`: `modal secret create coach-secrets REACTOR_API_KEY='<reactor-key>' FRONTEND_ORIGIN='https://<vercel-url>'` once, then `modal deploy app.py`.
- [ ] `npx create-reactor-app reactor-probe --model=lingbot-world-2` in scratch; run it with the key; confirm you see video. Repeat with `--model=x2` if supported. This 10 minutes de-risks the whole demo.
- [ ] Commit `config.ts` exactly as Section 1. Lock the 3-min script (Section 4).

### Builder A — Phone `/play` screens 1–3 + 5 (frontend)
**0:25 – 1:30 · Enter → questions → street (LingBot World 2)**
`Play.tsx`: `h-[100dvh] overflow-hidden touch-none bg-black`, Coach palette (tan #B3894F, cream #F3EBDD, black), serif display font (Playfair/Cormorant) for campaign type.
1. Screen 1 "Tap to enter Coach's London" → `POST /api/session`, event `opened`, request `DeviceOrientationEvent.requestPermission()` inside the tap. Start fetching Reactor JWT now (hide latency).
2. Screen 2: three question cards, big buttons; bag question shows the 3 look-1 boards. Optional name input. `POST /api/answers`.
3. Screen 3 street: `lib/world.ts` `openWorld({jwt, anchorUrl, prompt, videoEl}) → { move(dir), look(dir), steer(prompt), close() }` per cheat-sheet. Loader: anchor still full-screen with slow zoom + campaign line typing until first frame. Fallback: if no frame in 8s keep the anchor still + parallax on tilt (never blank).
4. Controls: tilt (gamma) → `set_look_horizontal` left/right, idle when centred (debounce 300ms); big translucent "walk" button bottom-centre: pointerdown → forward, pointerup → idle; swipe left/right → strafe. Every 8s hot-swap prompt: `+ ", the Coach store glowing ahead, closer"`. Event `street_enter`, `walk` (accumulated ms).
5. After 25s or when they tap the pulsing "Enter Coach" chip → `store_enter` → hand off to Builder C's `Mirror` component (Screen 4).

**1:30 – 3:00 · Screen 5 film + share**
7. Screen 5 "Your chapter": show 3 lines (their chapter's default first) + "write your own"; tap → event `line`, `POST /api/film`. Holding screen: their selfie with "&Coach · {Name}, {Neighbourhood}" lockup + "Cutting your chapter…". Poll `GET /api/session/{id}` every 2s until `film_status==="ready"` → play `film_url` (9:16, autoplay, loop).
8. Buttons: Share (`navigator.share`, fallback copy) → `share`; Reserve the {Bag} at Coach Regent Street → `cta reserve`; Send to a friend → `cta send`. Confirmation: "See you on Regent Street."
9. `visibilitychange` → `drop`. Latency badge (ms since last command → next frame) small top-right in street + mirror.

**3:00 – 4:00 · Polish**
10. Transitions (framer-motion), campaign copy lines per chapter overlaid on street, haptics, all buttons ≥ 56px, iOS Safari test, Android Chrome test.

### Builder B — Content + backend generation (backend + assets)
**0:25 – 1:30 · Anchors, look boards, prompts**
1. `prompts.py`: `street_prompt(s)`: `f"First-person view walking down a street in {N.label}, London, {N.cue}, {C.mood}, a warm glowing Coach boutique with tan leather window display at the end of the street, cinematic 35mm film grain, Coach campaign colour palette of tan leather, cream and deep red"`
2. Anchor stills (30 = 6 neighbourhoods × 5 chapters) via Helios frame grabs (`reactor_utils.grab_still`, cropped to 9:16 portrait). Save to `frontend/public/neigh/{n}-{c}.png`. If short on time: 6 × 2 chapters, map others to nearest mood.
3. Look boards (9): same Helios path: `f"full-body fashion editorial photo of a model wearing a {outfit} and carrying a Coach {bag} bag in tan leather, neutral studio backdrop, &Coach campaign style, natural confident pose"` — 3 outfits per bag (streetwear / tailored / evening). Save `public/looks/{bag}-{i}.png`.
4. Probe `reactor/ltx2` once with a selfie + short script (`npx create-reactor-app ltx-probe --model=ltx2`); confirm video+audio lands.

**1:30 – 3:00 · `/api/answers`, `/api/selfie`, `make_film`**
5. `/api/answers`: fill `street_prompt`, `anchor_url` (`/neigh/{n}-{c}.png`, absolute using `FRONTEND_ORIGIN` env), default `line`.
6. `/api/selfie`: receive JPEG → write to `coach-files` volume (`selfies/{id}.jpg`) → `selfie_url` = `/api/files/…` → save.
7. `make_film(id)` (Modal function, `timeout=300`):
   - script = `f"{line} … &Coach."` (≤ 4s of speech)
   - avatar = selfie JPEG from the volume, else fetched `anchor_url`
   - `reactor_utils.render_take` drives `reactor/ltx2` (`upload_file` → `set_avatar_image` → `set_script` → `set_prompt` → `start`), buffers `main_video` frames + `main_audio` PCM until `generation_complete`, then `encode_mp4` (ffmpeg) → `films/{id}.mp4` on the volume → `film_url`, `film_status="ready"`. On exception → `failed` + `SAMPLE_FILM_URL`.
   - Pre-generate `SAMPLE_FILM_URL` with a stock portrait for seeds/failures.

**3:00 – 4:00 · Insight + localise**
8. `/api/insight`: return the same deterministic Coach strategy on every call, with exact shape `{headline, reasoning, segments, media_plan, localise}`. It does not read live session state, call an external model, or require a model key.
9. `/api/localise`: for each neighbourhood → Helios still poster: `f"Coach outdoor poster, {N.label} London street scene, {C.mood}, model with Coach {bag}, headline text '{C.label}. &Coach', tan and cream palette"` → URLs.

### Builder C — Mirror (X2), dashboard, QR, ops
**0:25 – 1:30 · Backend plumbing + QR**
1. Implement in `app.py`: `/api/session`, `/api/event`, `/api/session/{id}`, `/api/state`, `/api/reset`, `/api/seed`, `/api/reactor-token` (`httpx.post("https://api.reactor.inc/tokens", headers={"Reactor-API-Key": os.environ["REACTOR_API_KEY"]}).json()["jwt"]`). Dict helpers + `sessions` index list.
2. `Qr.tsx`: poster mock — full-screen Coach campaign-style poster (tan/cream, serif "&Coach — Your London"), big `<QRCodeSVG value={origin + "/play"} size={480}/>` bottom-right like a real OOH poster, short URL under it. Hotkey `D` → `/dash`.

**1:30 – 3:00 · Mirror (Screen 4) + dashboard**
3. `components/Mirror.tsx` (Builder A mounts it): `ReactorProvider modelName="reactor/x2"` + `WebcamStream track="source"` (front camera, hidden preview) + `ReactorView track="main_video"`. On ready: upload look board `/looks/{bag}-1.png` → `set_reference_image` → `set_prompt`. Swipe → next look → `set_reference_image` (auto-restart); look name chip. ♥ → `save(index)`. Auto-capture selfie: after 3s grab webcam frame → JPEG → `POST /api/selfie`. Fallback if X2 has no frame in 8s: webcam + look board PiP + "Try in store". "Continue →" after 20s or tap.
4. `Dash.tsx` dark, polls `/api/state` 1.5s: left = London map (SVG, 6 labelled zones; pulses per visitor, coloured by bag); right = counters + visitor list. Bottom = Look wall: `selfie_url` thumbnails; click → modal with `film_url`.

**3:00 – 4:00 · Reasoning + alive + safe**
5. Insight panel (hotkey `I`): `POST /api/insight` → typewriter reasoning (one step / 700ms) → headline, segments bars, media plan → "Generate localised posters" → `/api/localise` → rail "Ready to ship".
6. `/api/seed` (20 fake visitors; selfies from a stock pool; `SAMPLE_FILM_URL`). Hotkeys `S` seed, `C` reset, `I` insight, `F` fullscreen.
7. `RUNBOOK.md`: redeploy commands, env vars, kill switches (`localStorage.coach_no_reactor=1`), backup video location.

### 4:00 – 4:40 · ALL — rehearse ×3
Real phones iOS + Android, venue wifi + hotspot. Full flow < 3:00. Check: camera permission flow, gyro permission, LingBot first frame < 8s, X2 first frame < 8s, film < 60s, pins drop. Record backup video. **Freeze 4:20.**

### 4:40 – 5:00 · Pitch
Slides (5): 1) Poster photo + "&Coach. The 'and' is you." 2) LIVE demo 3) What happened: navigable world (LingBot World 2) → live try-on (X2) → personal film (LTX) → reasoning, all on Modal 4) Business: experiential OOH that converts — per-scan pricing + reservation attribution + UGC 5) Built in 5h with Devin. Roles: speaker · laptop (Dash + hotkeys) · phone handler/filmer.

## 3. Agent-ready tickets (paste one at a time)
- **T1 (all):** Scaffold `coach-london/` with `frontend/` (Vite React TS, Tailwind, react-router-dom, framer-motion, qrcode.react, @reactor-team/js-sdk) routes `/`, `/play`, `/dash`; `backend/app.py` Modal FastAPI hello world; `frontend/src/data/config.ts`. Commit.
- **T2 (C):** Implement all Section 1 endpoints except `/api/answers`, `/api/selfie`, `/api/film`, `/api/insight`, `/api/localise`, using `modal.Dict` helpers `get_session/save_session/all_sessions`. `/api/reactor-token` proxies Reactor tokens. Add `/api/seed`, `/api/reset`.
- **T3 (B):** `backend/prompts.py` with `street_prompt`, `look_prompt`, `poster_prompt`, `INSIGHT_SYSTEM`; script `backend/gen_assets.py` generating 30 anchor stills + 9 look boards via Reactor Helios frame grabs into `frontend/public/{neigh,looks}/`.
- **T4 (B):** `/api/answers`, `/api/selfie` (volume upload), `/api/film` + Modal function `make_film` (Reactor `reactor/ltx2` take → mp4 on volume), `SAMPLE_FILM_URL` fallback, timings logged.
- **T5 (A):** `Play.tsx` screens 1–3 + `lib/world.ts` (LingBot World 2 per cheat-sheet; 8s fallback to still).
- **T6 (C):** `components/Mirror.tsx` (X2 with WebcamStream `source`, reference image swap on swipe, ♥ save, auto-selfie → `/api/selfie`, 8s fallback).
- **T7 (A):** Screen 5 film (line picker → `/api/film` → poll → play), share/CTA buttons, drop event, latency badge, transitions.
- **T8 (C):** `Qr.tsx` poster + `Dash.tsx` (map, counters, visitor list, look wall, insight panel, hotkeys).
- **T9 (B):** `/api/insight` (deterministic Coach strategy JSON) + `/api/localise` (Reactor Helios posters).
- **T10 (C):** `RUNBOOK.md`, kill switch, seed pool, dashboard polish.

## 4. Three-minute demo script
- 0:00 Slide: real-looking Coach poster with QR. "Coach's new platform is called &Coach. Confidence without conformity — the 'and' is you. But a poster can't fit you in. Scan this."
- 0:30 Judges answer. Pins drop: "Soho. Shoreditch. Camden. Three Londons."
- 0:50 "Look at your phone — that's your street. Tilt to look. Hold to walk. That's Reactor's LingBot World 2 rendering a London that didn't exist a second ago. See the store? Walk in."
- 1:30 "Now look at yourself." Mirror: "That's Reactor X2 — you, in the Brooklyn, live. Swipe. Save the one you'd actually wear."
- 2:00 "Pick your line." Films render. "That's Reactor LTX generating your lip-synced &Coach film through Modal. Jake, a creator would post that in a heartbeat."
- 2:25 Dash `I`: deterministic Coach strategy types out → media plan → Helios posters. "Three people's Londons just became Coach's OOH plan and three localised posters. That's a shippable strategy, not impressions."
- 2:50 "Built in five hours with Devin. The poster used to be the end of the ad. Now it's the door."

## 5. Risks → mitigations
- LingBot World 2 startup/latency → prefetch JWT during questions; anchor still with parallax until first frame; 8s fallback; kill switch.
- X2 webcam on iOS → `playsInline`, permission on a tap ("Step in front of the mirror"), front camera constraints; fallback = webcam + look card PiP.
- Two Reactor sessions per phone → close World before opening Mirror (`disconnect()`), never both.
- Reactor LTX film slow or unavailable → holding screen, `SAMPLE_FILM_URL` on failure; pre-generate 3 LTX films with team selfies.
- Venue wifi → hotspot; polling; Vercel + Modal CDN; `min_containers=1`.
- Trademark → footer "Concept demo. Not affiliated with Coach / Tapestry."
- Judges don't want to selfie → "Skip mirror" path uses the look board as the film image.
