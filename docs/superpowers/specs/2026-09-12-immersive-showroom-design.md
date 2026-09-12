# &Coach Immersive Showroom Design

## Goal

Replace the post-door X2 try-on and personalised film with a reliable navigable Reactor experience inspired by the uploaded “Find Your Courage” video. The world culminates in two product plinths for the white Tabby and brown Brooklyn. Close-up views must use the supplied product images without generative distortion.

## User journey

1. The QR poster, personalisation questions, and current LingBot London street remain.
2. Entering the Coach door closes LingBot before opening another Reactor session.
3. `videoplayback.mp4` plays as a full-screen 15-second portal transition. JWT and persistent-world state prefetch during playback.
4. Reactor HappyOyster Adventure opens a first-person pink Coach dreamscape based on a landscape anchor derived from the theme video.
5. The world presents two illuminated plinths: Tabby to the left and Brooklyn to the right. The user holds to walk and uses look controls.
6. Persistent product controls let the user focus either plinth. Selecting one opens an exact product close-up over the live world.
7. The close-up supports pinch/wheel zoom, drag/pan, reset, switching between Tabby and Brooklyn, returning to the world, and a product CTA.
8. The experience ends on a concise “Carry your courage” selection confirmation rather than the mirror/selfie/LTX film flow.

## Reactor model

Use `@reactor-models/happy-oyster` in `mode="adventure"`. This model is purpose-built for persistent explorable worlds, accepts a prompt plus optional landscape starting image, exposes first-person movement/look/interaction controls, and permits two-minute travel sessions.

The world prompt describes a surreal pink and red Coach garden at sunset: luminous archways echoing the uploaded film, soft wildflowers, a central stone path, and two museum-lit leather-goods plinths ahead. It must avoid readable generated text and avoid claiming exact product fidelity.

The starting image is a checked-in 16:9 anchor derived from the uploaded vertical video using a sharp central frame over a blurred horizontal extension. HappyOyster requires a landscape image with aspect ratio between 1.5 and 2.0. The uploaded video remains the exact visual portal; the anchor transfers its palette and forms into the generated world.

## Persistent world lifecycle

The backend stores one encrypted HappyOyster Adventure world ID in the existing Modal Dict under `immersive_world_id`.

- `GET /api/immersive-world` returns `{world_id: string | null}`.
- `POST /api/immersive-world` accepts `{world_id}` and stores the first non-empty ID; later callers receive the existing ID.
- The browser fetches the world ID during the portal video.
- If present, it calls `attachWorld(world_id)` then `startTravel()`.
- If absent, it calls `createWorld({prompt, firstFrameImageUrl, perspective:"first_person"})`, stores the encrypted ID, then starts travel.
- Concurrent first-time creation is acceptable; the backend’s first stored valid ID becomes canonical.
- Disconnect on world exit, component unmount, travel failure, and before any retry.

No Reactor API key reaches the browser; the existing Modal token endpoint supplies a short-lived JWT.

## Product fidelity and interaction

The supplied files map as follows:

- `shopping/shopping.webp` → white Tabby
- `shopping/shopping (1).webp` → brown Brooklyn

Copy them into stable public names:

- `frontend/public/products/tabby.webp`
- `frontend/public/products/brooklyn.webp`

Generated plinths establish atmosphere only. When a user selects a product, the exact WebP is rendered in a dedicated foreground inspector. The inspector starts at 1×, allows 1×–4× scale, constrains panning so the image remains recoverable, and includes accessible buttons for zoom, reset, switch product, close, and CTA. Touch gestures supplement rather than replace buttons.

## UI and controls

The portal and world retain the Coach black/tan/cream/red palette and full `100dvh` phone treatment. Controls remain at least 56px.

World controls:

- Hold “Walk into courage” → HappyOyster `move("Front")`; release → `release("move")` or documented stop equivalent.
- Left/right look controls use documented HappyOyster Adventure held controls.
- “Explore Tabby” and “Explore Brooklyn” are explicit product-focus controls. They are always available after the world stream starts because HappyOyster does not expose semantic object proximity.
- World status communicates creating, attaching, streaming, ended, and fallback states.

Fallback behavior:

- If the HappyOyster stream does not start within 12 seconds, continue looping the uploaded portal video as the background and expose both exact product controls.
- `localStorage.coach_no_reactor === "1"` immediately selects that fallback.
- Missing product assets show branded placeholders, never broken images.

## Removed behavior

Remove the camera permission step, X2 provider/component, outfit look boards, selfie upload from the phone journey, line picker, LTX film generation trigger, share-film actions, and mirror-specific state. The backend can retain legacy selfie/film endpoints temporarily for compatibility, but the new frontend must not call them. Remove the X2 frontend dependency when no remaining import uses it.

## Session and dashboard changes

Extend session state with:

- `immersive_entered: boolean`
- `viewed_products: string[]`
- `selected_product: "tabby" | "brooklyn" | null`
- `world_ms: number`

Add event types `immersive_enter`, `product_view`, `product_select`, and `world_time`. Keep old event fields readable for seeded/legacy sessions.

Update dashboard language from try-ons/films to world entries/product views/product selections. Replace the selfie/film look wall with a product-interest wall showing each visitor’s selected exact product. Keep the map, deterministic strategy, poster generation, seed/reset, and hotkeys.

## Error handling

- Every Reactor failure transitions to portal-video fallback with a retry action.
- A failed world-ID fetch may create a temporary world but must not block product exploration.
- A failed world-ID save does not terminate the active travel.
- Product controls remain usable independently of Reactor state.
- Backend rejects blank world IDs and invalid product event values with 422 responses.

## Testing

Frontend tests cover:

- Door transition closes LingBot before portal/world mount.
- Portal video playback and HappyOyster attach/create lifecycle.
- One HappyOyster session at a time and cleanup on failures/unmount.
- 12-second and kill-switch fallbacks.
- Exact product mapping, switch, zoom, pan/reset, and CTA.
- No camera/X2/selfie/film calls remain in the journey.
- Dashboard product metrics and legacy-session resilience.
- Production build still copies the base Reactor WASM runtime.

Backend tests cover persistent world ID endpoints, new event validation/state updates, seed compatibility, and unchanged deterministic strategy.

Manual production verification uses a real phone to confirm portal playback, HappyOyster stream start, held movement/look controls, exact product close-ups, and no camera prompt.

## Deployment

Deploy Modal first, then Vercel with the existing `VITE_API_URL`. Prewarm once by completing the door transition; verify the resulting encrypted world ID is returned by `GET /api/immersive-world`. Rehearse both live and `coach_no_reactor` fallback paths. The uploaded theme video and exact product assets are static Vercel files.