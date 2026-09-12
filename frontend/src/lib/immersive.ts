export const IMMERSIVE_PROMPT = 'First-person exploration of a surreal pink and deep-red Coach garden at sunset, luminous rounded archways, soft wildflowers, a central stone path, two museum-lit leather-goods plinths ahead, cinematic dream atmosphere, no readable text, no logos.'

export const IMMERSIVE_STREAM_TIMEOUT_MS = 12_000
export const REACTOR_KILL_SWITCH_KEY = 'coach_no_reactor'

export type ImmersiveStatus =
  | 'connecting'
  | 'attaching'
  | 'creating'
  | 'streaming'
  | 'ended'
  | 'fallback'

export function reactorKillSwitchEnabled() {
  return typeof window !== 'undefined' && window.localStorage.getItem(REACTOR_KILL_SWITCH_KEY) === '1'
}
