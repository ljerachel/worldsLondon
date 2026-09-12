"""Generate anchor stills + look boards via Reactor Helios into frontend/public/.

Reactor has no text-to-image model, so each still is a frame captured from a
short Helios generation, centre-cropped to portrait.

Usage: REACTOR_API_KEY=... python gen_assets.py [--quick]
  --quick: 6 neighbourhoods x 2 chapters (12 anchors) instead of all 30.
"""
import argparse
import asyncio
import os
import pathlib

import prompts
import reactor_utils
import reactor_sdk

OUT = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "public"
CONCURRENCY = int(os.environ.get("GEN_CONCURRENCY", 2))


async def gen(prompt: str, path: pathlib.Path, sem: asyncio.Semaphore) -> None:
    if path.exists():
        print(f"skip {path.name}")
        return
    async with sem:
        for attempt in range(1, 9):
            try:
                frame = await reactor_utils.grab_still(prompt, os.environ["REACTOR_API_KEY"])
                break
            except (reactor_sdk.errors.RateLimitedError, Exception) as e:
                print(f"{path.name} attempt {attempt}: {e}")
                if attempt == 8:
                    print(f"FAILED {path.name}")
                    return
                await asyncio.sleep(min(10 * 2 ** (attempt - 1), 60))
        reactor_utils.save_still(frame, path, aspect="9:16")
        print(f"wrote {path}")


async def main_async() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--quick", action="store_true")
    args = p.parse_args()

    sem = asyncio.Semaphore(CONCURRENCY)
    tasks = []
    chapters = list(prompts.CHAPTERS)[: 2 if args.quick else len(prompts.CHAPTERS)]
    for n in prompts.NEIGHBOURHOODS:
        for c in chapters:
            tasks.append(gen(
                prompts.street_prompt({"neighbourhood": n, "chapter": c}),
                OUT / "neigh" / f"{n}-{c}.png",
                sem,
            ))
    for bag in prompts.BAGS:
        for i, style in enumerate(prompts.LOOK_STYLES, start=1):
            tasks.append(gen(
                prompts.look_prompt(bag, style),
                OUT / "looks" / f"{bag}-{i}.png",
                sem,
            ))
    await asyncio.gather(*tasks)


if __name__ == "__main__":
    asyncio.run(main_async())
