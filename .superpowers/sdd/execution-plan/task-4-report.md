# Task 4 Report

## Status

Complete. The live projector dashboard now satisfies amended T8, including a deterministic frontend-only Coach strategy that never calls `api.insight`.

## Inherited-test handling

Preserved and adapted the interrupted worker's untracked `frontend/src/pages/Dash.test.tsx`. Removed the stale remote-insight expectation, asserted the fixed local strategy and repeated `api.insight` non-use, retained polling/map/counter/visitor/look-wall/modal/hotkey coverage, and changed the resilience case to exercise state and Reactor localisation failures. Corrected fake-timer React flushing while taking the suite to GREEN.

## RED verification

Before production edits:

- Command: `npm test -- --run src/pages/Dash.test.tsx`
- Result: genuine RED — 1 test file failed; 6/6 tests failed against the raw-JSON dashboard.
- Representative failures: missing `counter-scans`, visitor/map UI, deterministic reasoning, reconnecting state, and hotkey actions.

## Implementation

- `frontend/src/pages/Dash.tsx`
  - Polls backend state immediately and every 1.5 seconds, retaining prior data and showing a reconnecting state on failure.
  - Renders all eight backend counters directly.
  - Renders six configured neighbourhood zones from coordinates and one coloured pulse per visitor.
  - Adds visitor list, configured labels, selfie/look fallback wall, and playable film modal.
  - Adds deterministic four-step Coach strategy at 700 ms intervals, headline, segments, and media plan without any `api.insight` access.
  - Calls Reactor-backed `api.localise` with fixed valid neighbourhoods `soho` and `peckham`, bag `brooklyn`, and chapter `bignight`; renders returned posters, empty results, loading, and failure states.
  - Adds S seed, C confirmed reset, I insight, and F fullscreen hotkeys with listener/timer cleanup.
  - Uses responsive projector layouts and only the exact shared Coach palette tokens.
- `frontend/src/pages/Dash.test.tsx`
  - Adds six focused dashboard behavior tests, including an explicit guarantee that `api.insight` is never called.
- `frontend/src/pages/Qr.tsx`
  - Preserved unchanged; no evidenced defect found.

## GREEN verification

- Focused: `npm test -- --run src/pages/Dash.test.tsx` — 1 file passed, 6 tests passed.
- Full frontend: `npm test` — 3 files passed, 26 tests passed.
- Lint: `npm run lint` — 0 warnings, 0 errors.
- Production build: `npm run build` — TypeScript and Vite build passed.
- Hygiene: `git diff --check` passed.

## Self-review

Confirmed direct backend count rendering, all six coordinate-driven labels, pulse cardinality, valid localise payload, failed/empty poster handling, fallback look indexing, modal controls, confirmation behavior, repeated-insight timer replacement, unmount cleanup, backend-failure resilience, and absence of `api.insight` or `/api/insight` in production dashboard code. No unrelated production files changed.

## SHA

Implementation and tests: `928180e`

## Concerns

No known blockers. The dashboard's hard-coded strategy and localisation inputs are intentionally deterministic per the amended requirement; they do not adapt to live aggregate behavior.
