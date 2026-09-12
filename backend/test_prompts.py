import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

import app
import prompts


EXPECTED_STRATEGY = {
    "headline": "Big nights belong to Soho",
    "reasoning": [
        "Soho leads evening visits",
        "Brooklyn earns the most saves",
        "Film sharing peaks after store time",
        "OOH should meet the night audience",
    ],
    "segments": [
        {"label": "Night explorers", "share": 62},
        {"label": "Quiet creatives", "share": 38},
    ],
    "media_plan": [
        "Soho station takeovers",
        "Run from 6pm",
        "Lead with Brooklyn stories",
    ],
    "localise": ["soho", "peckham"],
}


class PromptTests(unittest.TestCase):
    def test_street_prompt_is_deterministic_and_uses_config(self):
        session = {"neighbourhood": "soho", "chapter": "bignight"}
        expected = (
            "First-person view walking down a street in Soho, London, narrow streets, "
            "theatre marquees, red lanterns, bars, night, wet streets reflecting neon, "
            "buzzing, a warm glowing Coach boutique with tan leather window display at "
            "the end of the street, cinematic 35mm film grain, Coach campaign colour "
            "palette of tan leather, cream and deep red"
        )
        self.assertEqual(prompts.street_prompt(session), expected)
        self.assertEqual(prompts.street_prompt(session), expected)

    def test_look_poster_and_film_prompts_are_deterministic(self):
        self.assertIn("Coach Brooklyn bag", prompts.look_prompt("brooklyn", "tailored"))
        self.assertIn("Soho London street scene", prompts.poster_prompt("soho", "bignight", "brooklyn"))
        self.assertEqual(prompts.film_script("My chapter."), "My chapter. … &Coach.")
        film = prompts.film_prompt({"chapter": "bignight"})
        self.assertIn("natural British accent", film)
        self.assertIn(prompts.CHAPTERS["bignight"]["mood"], film)

    def test_coach_strategy_has_one_exact_deterministic_api_shape(self):
        first = prompts.coach_strategy()
        second = prompts.coach_strategy()
        self.assertEqual(first, EXPECTED_STRATEGY)
        self.assertEqual(second, EXPECTED_STRATEGY)
        self.assertIsNot(first, second)
        self.assertEqual(
            set(first),
            {"headline", "reasoning", "segments", "media_plan", "localise"},
        )

    def test_insight_needs_no_sessions_or_model_runtime(self):
        with patch.object(app, "all_sessions", side_effect=AssertionError("must not read live state")):
            self.assertEqual(app.insight(), EXPECTED_STRATEGY)

    def test_insight_endpoint_returns_exact_strategy_shape(self):
        from fastapi.testclient import TestClient

        response = TestClient(app.web).post("/api/insight")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), EXPECTED_STRATEGY)


if __name__ == "__main__":
    unittest.main()
