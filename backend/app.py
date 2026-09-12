"""&Coach: Your London — Modal backend.

Manual curl examples (replace $BASE with the deployed URL):
  curl -X POST $BASE/api/session
  curl -X POST $BASE/api/answers -H 'content-type: application/json' \
    -d '{"id":"k3j9","name":"Seva","neighbourhood":"soho","chapter":"bignight","bag":"brooklyn"}'
  curl -X POST $BASE/api/event -H 'content-type: application/json' \
    -d '{"id":"k3j9","type":"walk","value":4200}'
  curl $BASE/api/session/k3j9
  curl $BASE/api/state
  curl -X POST $BASE/api/reactor-token
  curl -X POST $BASE/api/seed -H 'content-type: application/json' -d '{"n":20}'
  curl -X POST $BASE/api/reset
"""

import os
import random
import secrets as pysecrets
import time

import modal
from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = modal.App("coach-london")
image = (
    modal.Image.debian_slim()
    .pip_install("fastapi[standard]", "fal-client", "openai", "httpx", "python-multipart")
    .add_local_file("prompts.py", "/root/prompts.py")
)
state = modal.Dict.from_name("coach-state", create_if_missing=True)

web = FastAPI()
web.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

SAMPLE_FILM_URL = os.environ.get("SAMPLE_FILM_URL", "")
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "")

import prompts  # noqa: E402  (added to the Modal image above; also importable locally)


def new_session() -> dict:
    return {
        "id": pysecrets.token_hex(3),
        "name": "",
        "neighbourhood": "",
        "chapter": "",
        "bag": "",
        "street_prompt": "",
        "anchor_url": "",
        "step": "opened",
        "look_index": 0,
        "saved_looks": [],
        "selfie_url": None,
        "line": "",
        "film_status": "none",
        "film_url": None,
        "shared": False,
        "cta": None,
        "walk_ms": 0,
        "store_ms": 0,
        "created_at": int(time.time()),
    }


def get_session(sid: str) -> dict | None:
    return state.get(f"session:{sid}")


def save_session(s: dict) -> None:
    state[f"session:{s['id']}"] = s


def all_sessions() -> list[dict]:
    return [state[f"session:{sid}"] for sid in state.get("sessions", [])]


@web.get("/api/health")
def health():
    return {"ok": True}


@web.post("/api/session")
def create_session():
    s = new_session()
    save_session(s)
    state["sessions"] = state.get("sessions", []) + [s["id"]]
    return {"id": s["id"]}


@web.post("/api/answers")
def answers(body: dict):
    s = get_session(body["id"])
    if s is None:
        return {"error": "unknown session"}, 404
    s["name"] = body.get("name", "")
    s["neighbourhood"] = body["neighbourhood"]
    s["chapter"] = body["chapter"]
    s["bag"] = body["bag"]
    s["street_prompt"] = prompts.street_prompt(s)
    s["anchor_url"] = (
        f"{FRONTEND_ORIGIN}/neigh/{s['neighbourhood']}-{s['chapter']}.png"
    )
    s["line"] = prompts.CHAPTERS[s["chapter"]]["line"]
    s["step"] = "street"
    save_session(s)
    return s


@web.post("/api/event")
def event(body: dict):
    s = get_session(body["id"])
    if s is None:
        return {"error": "unknown session"}, 404
    t, v = body["type"], body.get("value")
    if t == "street_enter":
        s["step"] = "street"
    elif t == "walk":
        s["walk_ms"] += int(v or 0)
    elif t == "store_enter":
        s["step"] = "store"
    elif t == "look":
        s["look_index"] = int(v or 0)
    elif t == "save":
        i = int(v or 0)
        if i not in s["saved_looks"]:
            s["saved_looks"].append(i)
    elif t == "selfie":
        s["selfie_url"] = v
    elif t == "line":
        s["line"] = v
    elif t == "share":
        s["shared"] = True
    elif t == "cta":
        s["cta"] = v
        s["step"] = "done"
    elif t == "drop":
        s["step"] = "done"
    save_session(s)
    return {"ok": True}


@web.post("/api/selfie")
async def selfie(id: str, file: UploadFile):
    import fal_client

    s = get_session(id)
    if s is None:
        return {"error": "unknown session"}, 404
    data = await file.read()
    url = fal_client.upload(data, "image/jpeg")
    s["selfie_url"] = url
    save_session(s)
    return {"selfie_url": url}


@web.post("/api/film")
def film(body: dict):
    s = get_session(body["id"])
    if s is None:
        return {"error": "unknown session"}, 404
    s["film_status"] = "pending"
    s["step"] = "film"
    save_session(s)
    make_film.spawn(s["id"])
    return {"film_status": "pending"}


@web.post("/api/reactor-token")
def reactor_token():
    import httpx

    r = httpx.post(
        "https://api.reactor.inc/tokens",
        headers={"Reactor-API-Key": os.environ["REACTOR_API_KEY"]},
        timeout=15,
    )
    r.raise_for_status()
    return {"jwt": r.json()["jwt"]}


@web.get("/api/session/{sid}")
def read_session(sid: str):
    s = get_session(sid)
    if s is None:
        return {"error": "unknown session"}, 404
    return s


@web.get("/api/state")
def get_state():
    sessions = all_sessions()
    counts = {
        "scans": len(sessions),
        "walking": sum(1 for s in sessions if s["step"] == "street"),
        "in_store": sum(1 for s in sessions if s["step"] == "store"),
        "tryons": sum(1 for s in sessions if s["look_index"] > 0 or s["saved_looks"]),
        "saves": sum(len(s["saved_looks"]) for s in sessions),
        "films": sum(1 for s in sessions if s["film_status"] == "ready"),
        "shares": sum(1 for s in sessions if s["shared"]),
        "reservations": sum(1 for s in sessions if s["cta"] == "reserve"),
    }
    return {"sessions": sessions, "counts": counts}


_insight_cache = {"at": 0.0, "result": None}


@web.post("/api/insight")
def insight():
    import json as _json

    import openai

    if time.time() - _insight_cache["at"] < 10 and _insight_cache["result"]:
        return _insight_cache["result"]
    sessions = all_sessions()
    client = openai.OpenAI()
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": prompts.INSIGHT_SYSTEM},
            {"role": "user", "content": _json.dumps(sessions)},
        ],
    )
    result = _json.loads(resp.choices[0].message.content)
    _insight_cache.update(at=time.time(), result=result)
    return result


@web.post("/api/localise")
def localise(body: dict):
    import fal_client

    posters = []
    for n in body["neighbourhoods"]:
        prompt = prompts.poster_prompt(n, body["chapter"], body["bag"])
        result = fal_client.subscribe(
            "fal-ai/flux/schnell",
            arguments={"prompt": prompt, "image_size": "portrait_4_3"},
        )
        posters.append({"neighbourhood": n, "url": result["images"][0]["url"]})
    return {"posters": posters}


@web.post("/api/seed")
def seed(body: dict | None = None):
    n = (body or {}).get("n", 20)
    names = ["Alex", "Sam", "Jo", "Maya", "Rio", "Tess", "Leo", "Nina"]
    for _ in range(n):
        s = new_session()
        s["name"] = random.choice(names)
        s["neighbourhood"] = random.choice(list(prompts.NEIGHBOURHOODS))
        s["chapter"] = random.choice(list(prompts.CHAPTERS))
        s["bag"] = random.choice(list(prompts.BAGS))
        s["street_prompt"] = prompts.street_prompt(s)
        s["anchor_url"] = f"{FRONTEND_ORIGIN}/neigh/{s['neighbourhood']}-{s['chapter']}.png"
        s["line"] = prompts.CHAPTERS[s["chapter"]]["line"]
        s["step"] = random.choice(["street", "store", "film", "done"])
        s["walk_ms"] = random.randint(5_000, 40_000)
        s["store_ms"] = random.randint(5_000, 60_000)
        s["saved_looks"] = random.sample(range(3), random.randint(0, 2))
        s["selfie_url"] = None
        s["film_status"] = "ready" if SAMPLE_FILM_URL else "none"
        s["film_url"] = SAMPLE_FILM_URL or None
        s["shared"] = random.random() < 0.3
        s["cta"] = random.choice([None, "reserve", "send"])
        save_session(s)
        state["sessions"] = state.get("sessions", []) + [s["id"]]
    return {"ok": True, "n": n}


@web.post("/api/reset")
def reset():
    for sid in state.get("sessions", []):
        try:
            del state[f"session:{sid}"]
        except KeyError:
            pass
    state["sessions"] = []
    _insight_cache.update(at=0.0, result=None)
    return {"ok": True}


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("coach-secrets")],
    timeout=300,
)
def make_film(sid: str) -> None:
    import fal_client

    s = get_session(sid)
    if s is None:
        return
    t0 = time.time()
    try:
        audio = fal_client.subscribe(
            "fal-ai/elevenlabs/tts/turbo-v2.5",
            arguments={"text": prompts.film_script(s["line"]), "voice": "Rachel"},
        )
        audio_url = audio["audio"]["url"] if "audio" in audio else audio["audio_url"]
        print(f"[make_film {sid}] tts {time.time()-t0:.1f}s")
        video = fal_client.subscribe(
            "veed/fabric-1.0",
            arguments={
                "image_url": s["selfie_url"] or s["anchor_url"],
                "audio_url": audio_url,
                "resolution": "480p",
            },
        )
        s["film_url"] = video["video"]["url"]
        s["film_status"] = "ready"
        print(f"[make_film {sid}] total {time.time()-t0:.1f}s")
    except Exception as e:  # never leave the phone hanging
        print(f"[make_film {sid}] failed: {e}")
        s["film_status"] = "failed"
        s["film_url"] = SAMPLE_FILM_URL or None
    save_session(s)


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("coach-secrets")],
    min_containers=1,
)
@modal.asgi_app()
def fastapi_app():
    return web
