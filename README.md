# HOME FOR CHRISTMAS

Personalised Coca-Cola "Holidays Are Coming" playable ad — 5-hour hackathon build.

Judge scans a QR, answers 3 questions, and the Coke truck rolls into a live-generated
Christmas market in *their* hometown (Reactor `reactor/helios`). They get a personalised
video Christmas card where Santa says their name (VEED Fabric via fal.ai). A projector
dashboard shows a world map of every judge's Christmas plus an AI-reasoned media plan.
Backend runs on Modal.

Full build spec (timeline, contracts, per-builder tickets, demo script):
[HOME_FOR_CHRISTMAS_BUILD_SPEC.md](HOME_FOR_CHRISTMAS_BUILD_SPEC.md)

## Layout

```
frontend/   Vite + React + TypeScript + Tailwind, deployed on Vercel
backend/    Modal app: FastAPI + modal.Dict (no DB), fal.ai + OpenAI jobs
content/    santa.png, jingle.mp3, fallback clips
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
modal secret create hfc-secrets REACTOR_API_KEY=... FAL_KEY=... OPENAI_API_KEY=...
modal deploy app.py    # or: modal serve app.py
```

Keys needed: `REACTOR_API_KEY`, `FAL_KEY`, `OPENAI_API_KEY`, Modal + Vercel accounts.

Concept demo for Coca-Cola. Not affiliated.
