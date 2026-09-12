"""Prompt builders + static config mirrored from frontend/src/data/config.ts."""

NEIGHBOURHOODS = {
    "shoreditch": {"label": "Shoreditch", "lat": 51.5246, "lng": -0.0776, "cue": "brick warehouses, street art, neon signs"},
    "soho":       {"label": "Soho",       "lat": 51.5136, "lng": -0.1365, "cue": "narrow streets, theatre marquees, red lanterns, bars"},
    "notting":    {"label": "Notting Hill", "lat": 51.5090, "lng": -0.1963, "cue": "pastel terraces, antique shopfronts, market stalls"},
    "camden":     {"label": "Camden",     "lat": 51.5390, "lng": -0.1426, "cue": "canal lock, market, punk shopfronts, bridges"},
    "southbank":  {"label": "South Bank", "lat": 51.5066, "lng": -0.1146, "cue": "riverside promenade, skateboarders, brutalist concrete, Thames"},
    "peckham":    {"label": "Peckham",    "lat": 51.4739, "lng": -0.0692, "cue": "rooftop bar, rye lane shopfronts, buses, sunset"},
}

CHAPTERS = {
    "firstday": {"label": "First day", "mood": "early morning golden light, empty streets, hopeful", "line": "Tomorrow's the first day. I'm ready."},
    "bignight": {"label": "Big night", "mood": "night, wet streets reflecting neon, buzzing", "line": "Tonight I'm not asking permission."},
    "sunday":   {"label": "Quiet Sunday", "mood": "soft overcast light, coffee cups, slow", "line": "No plans. That's the plan."},
    "leaving":  {"label": "Leaving town", "mood": "dusk, taxi headlights, suitcase, bittersweet", "line": "Some chapters you close on purpose."},
    "meeting":  {"label": "Meeting someone", "mood": "blue hour, warm windows, anticipation", "line": "Ten minutes early. Heart already there."},
}

BAGS = {"tabby": "Tabby", "brooklyn": "Brooklyn", "empire": "Empire"}
LOOK_STYLES = ["streetwear", "tailored", "evening"]


def street_prompt(s: dict) -> str:
    n = NEIGHBOURHOODS[s["neighbourhood"]]
    c = CHAPTERS[s["chapter"]]
    return (
        f"First-person view walking down a street in {n['label']}, London, {n['cue']}, "
        f"{c['mood']}, a warm glowing Coach boutique with tan leather window display at "
        f"the end of the street, cinematic 35mm film grain, Coach campaign colour "
        f"palette of tan leather, cream and deep red"
    )


def look_prompt(bag: str, style: str) -> str:
    return (
        f"full-body fashion editorial photo of a model wearing a {style} outfit and "
        f"carrying a Coach {BAGS[bag]} bag in tan leather, neutral studio backdrop, "
        f"&Coach campaign style, natural confident pose"
    )


def poster_prompt(neighbourhood: str, chapter: str, bag: str) -> str:
    n = NEIGHBOURHOODS[neighbourhood]
    c = CHAPTERS[chapter]
    return (
        f"Coach outdoor poster, {n['label']} London street scene, {c['mood']}, "
        f"model with Coach {BAGS[bag]}, headline text '{c['label']}. &Coach', "
        f"tan and cream palette"
    )


def film_script(line: str) -> str:
    return f"{line} … &Coach."


def film_prompt(s: dict) -> str:
    """LTX scene/delivery prompt — casts the voice and shot for the take."""
    mood = CHAPTERS.get(s.get("chapter", ""), {}).get("mood", "")
    return (
        "warm confident young Londoner speaking straight to camera, natural "
        f"British accent, gentle smile, cinematic soft light, {mood}, "
        "&Coach campaign energy"
    )


INSIGHT_SYSTEM = (
    "You are Coach's London media strategist for the &Coach platform. Reason step by "
    "step (4-6 short steps) over visitors' neighbourhood, chapter, bag, saved looks, "
    "store time, shares, reservations. Output JSON: headline (<=12 words), segments "
    "(2-3 with share %), media_plan (3 bullets: OOH sites, dayparts, creative angle), "
    "localise (top 3 neighbourhoods)."
)
