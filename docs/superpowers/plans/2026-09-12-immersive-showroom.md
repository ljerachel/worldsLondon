# &Coach Immersive Showroom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the post-door X2 mirror and LTX film journey with a HappyOyster Adventure dreamscape and exact zoomable Tabby/Brooklyn product exploration.

**Architecture:** Keep the existing QR, questions, and LingBot street. Entering the Coach door closes LingBot, plays the uploaded portal video, then attaches to or lazily creates one persistent HappyOyster world whose encrypted ID is stored in Modal Dict. Generated plinths provide atmosphere; exact product WebPs appear in a foreground inspector.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest/Testing Library, `@reactor-models/happy-oyster`, Reactor JS SDK 3.0.2, FastAPI, Modal Dict, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-12-immersive-showroom-design.md`

## Global Constraints

- Keep QR → questions → LingBot street unchanged until the Coach door.
- Close LingBot before HappyOyster connects; never run two Reactor models concurrently.
- Browser receives only a short-lived JWT; `REACTOR_API_KEY` remains on Modal.
- HappyOyster uses `mode="adventure"`, first-person perspective, a landscape 16:9 anchor, and documented held controls.
- Exact close-ups use `shopping.webp` as Tabby and `shopping (1).webp` as Brooklyn; generated imagery never substitutes for selected-product detail.
- Full phone surfaces use `100dvh`, Coach palette constants, and controls at least 56px.
- A 12-second timeout and `localStorage.coach_no_reactor === "1"` expose portal-video fallback with both products.
- Remove X2/camera/selfie/LTX-film calls from the new phone journey.
- Preserve legacy backend session fields/endpoints so existing dashboard data does not crash.
- Write each behavior test before production code and record RED then GREEN.

---

### Task 1: Stable product and portal assets

**Files:**
- Create: `frontend/public/products/tabby.webp`
- Create: `frontend/public/products/brooklyn.webp`
- Create: `frontend/public/immersive/portal.mp4`
- Create: `frontend/public/immersive/world-anchor.jpg`
- Create: `frontend/src/data/products.ts`
- Create: `frontend/src/data/products.test.ts`

**Interfaces:**
- Consumes: `shopping/shopping.webp`, `shopping/shopping (1).webp`, `videoplayback.mp4`.
- Produces: `PRODUCTS`, `ProductKey`, `PORTAL_VIDEO_URL`, `WORLD_ANCHOR_URL`, and static public assets.

- [ ] **Step 1: Write the failing mapping test**

```ts
import { expect, test } from 'vitest'
import { PRODUCTS } from './products'

test('maps exact supplied images to Tabby and Brooklyn', () => {
  expect(PRODUCTS.tabby.imageUrl).toBe('/products/tabby.webp')
  expect(PRODUCTS.brooklyn.imageUrl).toBe('/products/brooklyn.webp')
  expect(Object.keys(PRODUCTS)).toEqual(['tabby', 'brooklyn'])
})
```

- [ ] **Step 2: Run RED**

Run: `cd frontend && npm test -- src/data/products.test.ts`
Expected: FAIL because `products.ts` does not exist.

- [ ] **Step 3: Add constants and exact assets**

```ts
export const PRODUCTS = {
  tabby: { label: 'Tabby', imageUrl: '/products/tabby.webp', side: 'left' },
  brooklyn: { label: 'Brooklyn', imageUrl: '/products/brooklyn.webp', side: 'right' },
} as const
export type ProductKey = keyof typeof PRODUCTS
export const PORTAL_VIDEO_URL = '/immersive/portal.mp4'
export const WORLD_ANCHOR_URL = '/immersive/world-anchor.jpg'
```

Copy the supplied WebPs and video byte-for-byte. Generate `world-anchor.jpg` at 1280×720 from a representative portal frame using blurred edge fill and a sharp centered frame; verify aspect ratio is 16:9.

- [ ] **Step 4: Run GREEN and asset validation**

Run: `cd frontend && npm test -- src/data/products.test.ts && file public/products/* public/immersive/* && ffprobe -v error -show_entries stream=width,height public/immersive/world-anchor.jpg`
Expected: test passes; WebPs and MP4 retain source formats; anchor is 1280×720 JPEG.

- [ ] **Step 5: Commit**

```bash
git add frontend/public frontend/src/data/products.ts frontend/src/data/products.test.ts
git commit -m "add immersive showroom assets"
```

### Task 2: Persistent world and product session contracts

**Files:**
- Modify: `backend/app.py`
- Modify: `backend/test_prompts.py`
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Consumes: existing `modal.Dict` state helpers and generic event endpoint.
- Produces: `GET/POST /api/immersive-world`; session fields `immersive_entered`, `viewed_products`, `selected_product`, `world_ms`; frontend API methods `getImmersiveWorld()` and `saveImmersiveWorld(worldId)`.

- [ ] **Step 1: Add failing backend contract tests**

```py
def test_new_session_has_immersive_fields(self):
    session = app.new_session()
    self.assertFalse(session["immersive_entered"])
    self.assertEqual(session["viewed_products"], [])
    self.assertIsNone(session["selected_product"])
    self.assertEqual(session["world_ms"], 0)
```

Add tests that the first non-empty world ID is canonical, blank IDs return 422, `product_view` deduplicates `tabby`/`brooklyn`, `product_select` sets the exact product, and invalid products return 422.

- [ ] **Step 2: Run RED**

Run: `cd backend && .venv/bin/python -m unittest test_prompts -v`
Expected: FAIL for absent fields/endpoints/event handling.

- [ ] **Step 3: Implement backend contracts**

```py
@web.get('/api/immersive-world')
def immersive_world():
    return {'world_id': state.get('immersive_world_id')}

@web.post('/api/immersive-world')
def save_immersive_world(body: dict):
    world_id = str(body.get('world_id', '')).strip()
    if not world_id:
        raise HTTPException(422, 'world_id is required')
    existing = state.get('immersive_world_id')
    if not existing:
        state['immersive_world_id'] = world_id
    return {'world_id': existing or world_id}
```

Extend `new_session`, event handling, seed data, and dashboard counts without deleting legacy fields.

- [ ] **Step 4: Add typed frontend methods**

```ts
getImmersiveWorld: () => get<{ world_id: string | null }>('/api/immersive-world'),
saveImmersiveWorld: (worldId: string) => post<{ world_id: string }>('/api/immersive-world', { world_id: worldId }),
```

Extend `Session` and `EventType` with the exact fields/events from the design.

- [ ] **Step 5: Run GREEN**

Run: `cd backend && .venv/bin/python -m unittest discover -s . -p 'test_*.py' -v && python -m py_compile app.py`
Expected: all backend tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app.py backend/test_prompts.py frontend/src/lib/api.ts
git commit -m "add persistent immersive world state"
```

### Task 3: Product inspector

**Files:**
- Create: `frontend/src/components/ProductInspector.tsx`
- Create: `frontend/src/components/ProductInspector.test.tsx`

**Interfaces:**
- Consumes: `ProductKey`, `PRODUCTS`, `onView(product)`, `onSelect(product)`, `onClose()`.
- Produces: exact 1×–4× product inspection with switch, zoom, pan, reset, CTA, and close controls.

- [ ] **Step 1: Write failing interaction tests**

```tsx
render(<ProductInspector initialProduct="tabby" onView={onView} onSelect={onSelect} onClose={onClose} />)
expect(screen.getByRole('img', { name: 'Tabby close-up' })).toHaveAttribute('src', '/products/tabby.webp')
await user.click(screen.getByRole('button', { name: 'View Brooklyn' }))
expect(onView).toHaveBeenCalledWith('brooklyn')
await user.click(screen.getByRole('button', { name: 'Choose Brooklyn' }))
expect(onSelect).toHaveBeenCalledWith('brooklyn')
```

Add tests for 1×–4× zoom bounds, reset, close, drag/pointer pan, and missing-image fallback.

- [ ] **Step 2: Run RED**

Run: `cd frontend && npm test -- src/components/ProductInspector.test.tsx`
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement inspector**

Use one transform container with `{scale, x, y}` state. Buttons change scale by `0.5`, clamp 1–4, reset to `{1,0,0}`, switch products resets transform and calls `onView`, and CTA calls `onSelect`. Pointer movement pans only while scale exceeds 1.

- [ ] **Step 4: Run GREEN**

Run: `cd frontend && npm test -- src/components/ProductInspector.test.tsx`
Expected: all inspector tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ProductInspector.tsx frontend/src/components/ProductInspector.test.tsx
git commit -m "add exact product close-up inspector"
```

### Task 4: HappyOyster Adventure world

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/src/lib/immersive.ts`
- Create: `frontend/src/components/ImmersiveWorld.tsx`
- Create: `frontend/src/components/ImmersiveWorld.test.tsx`

**Interfaces:**
- Consumes: JWT, `api.getImmersiveWorld`, `api.saveImmersiveWorld`, `WORLD_ANCHOR_URL`, exact product callbacks.
- Produces: `<ImmersiveWorld id jwt onViewProduct onSelectProduct />` with HappyOyster attach/create/start, held movement/look, timeout/kill-switch fallback, retry, and cleanup.

- [ ] **Step 1: Install the typed SDK**

Run: `cd frontend && npm add @reactor-models/happy-oyster@1.0.0`
Expected: package and lockfile contain the pinned dependency.

- [ ] **Step 2: Write failing lifecycle tests**

Mock `@reactor-models/happy-oyster/react` and assert:

```tsx
expect(api.getImmersiveWorld).toHaveBeenCalled()
expect(attachWorld).toHaveBeenCalledWith('world-1')
expect(startTravel).toHaveBeenCalled()
fireEvent.pointerDown(screen.getByRole('button', { name: 'Walk into courage' }))
expect(move).toHaveBeenCalledWith('Front')
fireEvent.pointerUp(screen.getByRole('button', { name: 'Walk into courage' }))
expect(release).toHaveBeenCalledWith('move')
```

Add create-and-save, 12-second fallback, kill switch, product button, retry, and disconnect-on-unmount tests.

- [ ] **Step 3: Run RED**

Run: `cd frontend && npm test -- src/components/ImmersiveWorld.test.tsx`
Expected: FAIL because the component does not exist.

- [ ] **Step 4: Implement typed world lifecycle**

```ts
export const IMMERSIVE_PROMPT = 'First-person exploration of a surreal pink and deep-red Coach garden at sunset, luminous rounded archways, soft wildflowers, a central stone path, two museum-lit leather-goods plinths ahead, cinematic dream atmosphere, no readable text, no logos.'
```

Use `HappyOysterProvider mode="adventure" jwt={jwt} autoConnect`, `HappyOysterVideo`, and `useHappyOyster`. Attach existing world; otherwise create with `{prompt: IMMERSIVE_PROMPT, firstFrameImageUrl: WORLD_ANCHOR_URL, perspective:'first_person'}`, save `encrypted_world_id`, then start travel. Explicitly disconnect for retry, failure, and unmount.

- [ ] **Step 5: Run GREEN and full frontend verification**

Run: `cd frontend && npm test && npm run lint && npm run build`
Expected: all tests, lint, and production build pass; Reactor WASM copy remains present.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/immersive.ts frontend/src/components/ImmersiveWorld.tsx frontend/src/components/ImmersiveWorld.test.tsx
git commit -m "add HappyOyster immersive world"
```

### Task 5: Replace mirror and film with portal/showroom flow

**Files:**
- Modify: `frontend/src/pages/Play.tsx`
- Modify: `frontend/src/pages/Play.test.tsx`
- Delete: `frontend/src/components/Mirror.tsx`
- Delete: `frontend/src/components/Mirror.test.tsx`
- Delete: `frontend/src/lib/mirror.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

**Interfaces:**
- Consumes: current street `onEnterStore`, `PORTAL_VIDEO_URL`, `ImmersiveWorld`, `ProductInspector`, immersive API events.
- Produces: stages `enter | questions | street | portal | immersive | product | complete` and no X2/camera/film journey calls.

- [ ] **Step 1: Replace old tests with failing journey tests**

Assert entering the store removes the LingBot stage before rendering the portal video; portal end mounts the immersive world; selecting Tabby/Brooklyn opens exact inspector; choosing emits `product_select`; complete screen names selected product. Assert `navigator.mediaDevices.getUserMedia`, `api.uploadSelfie`, and `api.startFilm` are never called.

- [ ] **Step 2: Run RED**

Run: `cd frontend && npm test -- src/pages/Play.test.tsx`
Expected: FAIL because the old mirror and film stages still render.

- [ ] **Step 3: Implement new state machine**

Portal stage uses:

```tsx
<video src={PORTAL_VIDEO_URL} autoPlay playsInline controls onEnded={() => setStage('immersive')} />
```

Include a “Enter the world” skip after three seconds. Prefetch JWT/world state during portal playback. Immersive product callbacks send exact `immersive_enter`, `product_view`, `product_select`, and accumulated `world_time` events. Product close returns to the live world; product select enters confirmation.

- [ ] **Step 4: Remove X2 code**

Remove all Mirror imports/files, `@reactor-models/x2`, camera permission, selfie, line picker, polling, sharing, and film CTA code. Keep legacy API wrapper methods for backend compatibility only if dashboard types still use them.

- [ ] **Step 5: Run GREEN**

Run: `cd frontend && npm test && npm run lint && npm run build && git diff --check`
Expected: all checks pass; grep finds no X2/Mirror/getUserMedia use under `frontend/src`.

- [ ] **Step 6: Commit**

```bash
git add -A frontend
git commit -m "replace try-on with immersive product journey"
```

### Task 6: Product-focused dashboard, documentation, and deployment

**Files:**
- Modify: `frontend/src/pages/Dash.tsx`
- Modify: `frontend/src/pages/Dash.test.tsx`
- Modify: `README.md`
- Modify: `RUNBOOK.md`
- Modify: `COACH_LONDON_BUILD_SPEC.md`

**Interfaces:**
- Consumes: immersive session fields/counts and exact product assets.
- Produces: world-entry/product-view/selection dashboard and updated build/deploy/demo documentation.

- [ ] **Step 1: Add failing dashboard tests**

Assert counters show World entries, Product views, and Selections; product-interest wall uses exact Tabby/Brooklyn images; legacy sessions with absent immersive fields render without exceptions; map/strategy/posters/hotkeys remain.

- [ ] **Step 2: Run RED**

Run: `cd frontend && npm test -- src/pages/Dash.test.tsx`
Expected: FAIL because old try-on/film counters and film modal remain.

- [ ] **Step 3: Implement product dashboard**

Replace mirror/film cards and modal with selected-product cards. Derive safe defaults with `session.viewed_products ?? []` and `session.selected_product ?? null`. Preserve map, deterministic strategy, localisation, polling, seed/reset, and fullscreen.

- [ ] **Step 4: Update documentation**

Document HappyOyster Adventure, portal video, exact Tabby/Brooklyn inspector, persistent world endpoints, prewarm procedure, fallback mode, and removal of X2/LTX from the customer journey. Keep legacy backend endpoints clearly labeled compatibility-only.

- [ ] **Step 5: Run complete verification**

Run:

```bash
cd backend && .venv/bin/python -m unittest discover -s . -p 'test_*.py' -v
python -m py_compile app.py prompts.py reactor_utils.py gen_assets.py
cd ../frontend && npm test && npm run lint && npm run build
cd .. && git diff --check
```

Expected: all backend/frontend tests pass, lint has zero errors, build succeeds, and diff check is clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Dash.tsx frontend/src/pages/Dash.test.tsx README.md RUNBOOK.md COACH_LONDON_BUILD_SPEC.md
git commit -m "focus dashboard and docs on immersive products"
```

### Task 7: Production smoke and rehearsal

**Files:**
- Modify: `RUNBOOK.md` only if a verified command is incorrect.

**Interfaces:**
- Consumes: complete frontend/backend and existing Modal/Vercel projects.
- Produces: deployed URLs and verified live/fallback demo paths.

- [ ] **Step 1: Deploy Modal**

Run from `backend/`: `modal deploy app.py`. Verify health and both immersive-world endpoints without invoking world creation.

- [ ] **Step 2: Deploy Vercel**

Run from `frontend/`: `vercel deploy --prod --yes`. Verify `/play`, `/dash`, portal video, world anchor, and both product images return HTTP 200 with correct MIME types.

- [ ] **Step 3: Prewarm HappyOyster**

Run one real `/play` journey through the portal. Confirm HappyOyster creates/streams a world, then verify `GET /api/immersive-world` returns a non-empty encrypted ID. This step intentionally spends Reactor credits.

- [ ] **Step 4: Verify live path**

On a phone: street → door → portal → HappyOyster video → held movement/look → Tabby close-up → switch to Brooklyn → zoom/pan/reset → select → confirmation. Confirm no camera permission appears.

- [ ] **Step 5: Verify fallback path**

Set `localStorage.coach_no_reactor = '1'`, reload, and confirm portal loop plus both exact product controls complete the journey without a Reactor session.

- [ ] **Step 6: Push and open PR**

Run full Git status/diff/log review, push `devin/immersive-showroom`, and create a PR against `main` with live and fallback test evidence.