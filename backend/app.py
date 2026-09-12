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
import pathlib
import random
import secrets as pysecrets
import time

import modal
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

app = modal.App("coach-london")
image = (
    modal.Image.debian_slim()
    .apt_install("ffmpeg")
    .pip_install(
        "fastapi[standard]", "reactor-sdk==1.5.1", "httpx", "python-multipart", "numpy",
        "Pillow",
    )
    .add_local_file("prompts.py", "/root/prompts.py")
    .add_local_file("reactor_utils.py", "/root/reactor_utils.py")
)
state = modal.Dict.from_name("coach-state", create_if_missing=True)
files_vol = modal.Volume.from_name("coach-files", create_if_missing=True)
FILES = "/files"

web = FastAPI()
web.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

SAMPLE_FILM_URL = os.environ.get("SAMPLE_FILM_URL", "")
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "")

import prompts  # noqa: E402  (added to the Modal image above; also importable locally)
import reactor_utils  # noqa: E402


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
        "immersive_entered": False,
        "viewed_products": [],
        "selected_product": None,
        "world_ms": 0,
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


@web.get("/api/immersive-world")
def immersive_world():
    world_id = state.get("immersive_world_id")
    return {"world_id": world_id if isinstance(world_id, str) else None}


@web.post("/api/immersive-world")
def save_immersive_world(body: dict):
    raw_world_id = body.get("world_id")
    if not isinstance(raw_world_id, str) or not raw_world_id.strip():
        raise HTTPException(422, "world_id must be a non-empty string")
    world_id = raw_world_id.strip()
    existing = state.get("immersive_world_id")
    if not isinstance(existing, str) or not existing:
        state["immersive_world_id"] = world_id
        existing = world_id
    return {"world_id": existing}


@web.post("/api/answers")
def answers(body: dict):
    s = get_session(body["id"])
    if s is None:
        raise HTTPException(404, "unknown session")
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
        raise HTTPException(404, "unknown session")
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
    elif t == "immersive_enter":
        s["immersive_entered"] = True
    elif t == "product_view":
        if v not in ("tabby", "brooklyn"):
            raise HTTPException(422, "invalid product")
        viewed_products = s.get("viewed_products") or []
        if v not in viewed_products:
            viewed_products.append(v)
        s["viewed_products"] = viewed_products
    elif t == "product_select":
        if v not in ("tabby", "brooklyn"):
            raise HTTPException(422, "invalid product")
        s["selected_product"] = v
    elif t == "world_time":
        if isinstance(v, bool):
            raise HTTPException(422, "world_time must be a non-negative integer")
        try:
            world_ms = int(v)
        except (TypeError, ValueError, OverflowError):
            raise HTTPException(422, "world_time must be a non-negative integer") from None
        if world_ms < 0 or world_ms != v:
            raise HTTPException(422, "world_time must be a non-negative integer")
        s["world_ms"] = (s.get("world_ms") or 0) + world_ms
    save_session(s)
    return {"ok": True}


@web.post("/api/selfie")
async def selfie(request: Request, id: str = Form(...), file: UploadFile = File(...)):
    s = get_session(id)
    if s is None:
        raise HTTPException(404, "unknown session")
    data = await file.read()
    path = pathlib.Path(FILES) / "selfies" / f"{id}.jpg"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    files_vol.commit()
    url = f"{request.base_url}api/files/selfies/{id}.jpg"
    s["selfie_url"] = url
    save_session(s)
    return {"selfie_url": url}


@web.get("/api/files/{path:path}")
def get_file(path: str):
    root = pathlib.Path(FILES).resolve()
    p = (root / path).resolve()
    if not p.is_relative_to(root):
        raise HTTPException(404, "not found")
    try:
        files_vol.reload()
    except Exception:
        pass
    if not p.is_file():
        raise HTTPException(404, "not found")
    return FileResponse(p)


@web.post("/api/film")
def film(request: Request, body: dict):
    s = get_session(body["id"])
    if s is None:
        raise HTTPException(404, "unknown session")
    s["film_status"] = "pending"
    s["step"] = "film"
    s["_origin"] = str(request.base_url)
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
        raise HTTPException(404, "unknown session")
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
        "world_entries": sum(1 for s in sessions if s.get("immersive_entered", False)),
        "product_views": sum(len(s.get("viewed_products") or []) for s in sessions),
        "product_selections": sum(
            1 for s in sessions if s.get("selected_product") is not None
        ),
    }
    return {"sessions": sessions, "counts": counts}


@web.post("/api/insight")
def insight():
    return prompts.coach_strategy()


@web.post("/api/localise")
def localise(request: Request, body: dict):
    import asyncio

    posters = []
    for n in body["neighbourhoods"]:
        rel = f"posters/{n}-{body['chapter']}-{body['bag']}.jpg"
        path = pathlib.Path(FILES) / rel
        if not path.is_file():
            prompt = prompts.poster_prompt(n, body["chapter"], body["bag"])
            frame = asyncio.run(
                reactor_utils.grab_still(prompt, os.environ["REACTOR_API_KEY"])
            )
            path.parent.mkdir(parents=True, exist_ok=True)
            reactor_utils.save_still(frame, path, aspect="3:4")
            files_vol.commit()
        posters.append(
            {"neighbourhood": n, "url": f"{request.base_url}api/files/{rel}"}
        )
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
        s["immersive_entered"] = random.random() < 0.7
        if s["immersive_entered"]:
            s["viewed_products"] = random.sample(
                ["tabby", "brooklyn"], random.randint(0, 2)
            )
            s["selected_product"] = random.choice([None, *s["viewed_products"]])
            s["world_ms"] = random.randint(5_000, 120_000)
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
    return {"ok": True}


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("coach-secrets")],
    volumes={FILES: files_vol},
    timeout=300,
)
def make_film(sid: str) -> None:
    import asyncio
    import tempfile

    import httpx

    s = get_session(sid)
    if s is None:
        return
    t0 = time.time()
    try:
        files_vol.reload()
        with tempfile.TemporaryDirectory() as td:
            avatar = pathlib.Path(td) / "avatar.jpg"
            selfie_path = pathlib.Path(FILES) / "selfies" / f"{sid}.jpg"
            if selfie_path.is_file():
                avatar.write_bytes(selfie_path.read_bytes())
            else:
                r = httpx.get(s["anchor_url"], timeout=30)
                r.raise_for_status()
                avatar.write_bytes(r.content)
            frames, pcm, sr, ch = asyncio.run(
                reactor_utils.render_take(
                    str(avatar),
                    prompts.film_script(s["line"]),
                    prompts.film_prompt(s),
                    os.environ["REACTOR_API_KEY"],
                )
            )
            out = pathlib.Path(FILES) / "films" / f"{sid}.mp4"
            out.parent.mkdir(parents=True, exist_ok=True)
            reactor_utils.encode_mp4(frames, pcm, sr, ch, out)
            files_vol.commit()
        s["film_url"] = f"{s.get('_origin', '')}api/files/films/{sid}.mp4"
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
    volumes={FILES: files_vol},
    min_containers=1,
)
@modal.asgi_app()
def fastapi_app():
    return web
