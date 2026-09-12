"""Generate anchor stills + look boards via fal.ai into frontend/public/.

Usage: FAL_KEY=... python gen_assets.py [--quick]
  --quick: 6 neighbourhoods x 2 chapters (12 anchors) instead of all 30.
"""
import argparse
import os
import pathlib

import fal_client
import prompts

OUT = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "public"


def gen(prompt: str, path: pathlib.Path, model: str = "fal-ai/flux/schnell") -> None:
    if path.exists():
        print(f"skip {path.name}")
        return
    result = fal_client.subscribe(model, arguments={"prompt": prompt, "image_size": "portrait_16_9"})
    url = result["images"][0]["url"]
    import httpx

    path.write_bytes(httpx.get(url).content)
    print(f"wrote {path}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--quick", action="store_true")
    args = p.parse_args()

    chapters = list(prompts.CHAPTERS)[: 2 if args.quick else len(prompts.CHAPTERS)]
    for n in prompts.NEIGHBOURHOODS:
        for c in chapters:
            gen(
                prompts.street_prompt({"neighbourhood": n, "chapter": c}),
                OUT / "neigh" / f"{n}-{c}.png",
            )
    for bag in prompts.BAGS:
        for i, style in enumerate(prompts.LOOK_STYLES, start=1):
            gen(
                prompts.look_prompt(bag, style),
                OUT / "looks" / f"{bag}-{i}.png",
                model="fal-ai/flux/dev",
            )


if __name__ == "__main__":
    main()
