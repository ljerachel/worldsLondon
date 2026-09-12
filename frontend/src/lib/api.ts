export const BASE = import.meta.env.VITE_API_URL as string

export type Step = 'opened' | 'questions' | 'street' | 'store' | 'film' | 'done'
export type FilmStatus = 'none' | 'pending' | 'ready' | 'failed'

export interface Session {
  id: string
  name: string
  neighbourhood: string
  chapter: string
  bag: string
  street_prompt: string
  anchor_url: string
  step: Step
  look_index: number
  saved_looks: number[]
  selfie_url: string | null
  line: string
  film_status: FilmStatus
  film_url: string | null
  shared: boolean
  cta: 'reserve' | 'send' | null
  walk_ms: number
  store_ms: number
  immersive_entered?: boolean
  viewed_products?: string[]
  selected_product?: 'tabby' | 'brooklyn' | null
  world_ms?: number
  created_at: number
}

export type EventType =
  | 'street_enter'
  | 'walk'
  | 'store_enter'
  | 'look'
  | 'save'
  | 'selfie'
  | 'line'
  | 'share'
  | 'cta'
  | 'drop'
  | 'immersive_enter'
  | 'product_view'
  | 'product_select'
  | 'world_time'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json() as Promise<T>
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json() as Promise<T>
}

export const api = {
  createSession: () => post<{ id: string }>('/api/session', {}),
  getImmersiveWorld: () => get<{ world_id: string | null }>('/api/immersive-world'),
  saveImmersiveWorld: (worldId: string) =>
    post<{ world_id: string }>('/api/immersive-world', { world_id: worldId }),
  sendAnswers: (a: {
    id: string
    name: string
    neighbourhood: string
    chapter: string
    bag: string
  }) => post<Session>('/api/answers', a),
  sendEvent: (id: string, type: EventType, value?: number | string) =>
    post<{ ok: boolean }>('/api/event', { id, type, value }),
  uploadSelfie: async (id: string, file: Blob): Promise<{ selfie_url: string }> => {
    const form = new FormData()
    form.append('id', id)
    form.append('file', file, 'selfie.jpg')
    const res = await fetch(`${BASE}/api/selfie`, { method: 'POST', body: form })
    if (!res.ok) throw new Error(`/api/selfie -> ${res.status}`)
    return res.json()
  },
  startFilm: (id: string) => post<{ film_status: FilmStatus }>('/api/film', { id }),
  reactorToken: () => post<{ jwt: string }>('/api/reactor-token', {}),
  getSession: async (id: string): Promise<Session> => {
    const res = await fetch(`${BASE}/api/session/${id}`)
    if (!res.ok) throw new Error(`/api/session/${id} -> ${res.status}`)
    return res.json()
  },
  getState: async (): Promise<{
    sessions: Session[]
    counts: {
      scans: number
      walking: number
      in_store: number
      tryons: number
      saves: number
      films: number
      shares: number
      reservations: number
      world_entries?: number
      product_views?: number
      product_selections?: number
    }
  }> => {
    const res = await fetch(`${BASE}/api/state`)
    if (!res.ok) throw new Error(`/api/state -> ${res.status}`)
    return res.json()
  },
  insight: () =>
    post<{
      headline: string
      reasoning: string[]
      segments: { label: string; share: number }[]
      media_plan: string[]
      localise: string[]
    }>('/api/insight', {}),
  localise: (neighbourhoods: string[], bag: string, chapter: string) =>
    post<{ posters: { neighbourhood: string; url: string }[] }>('/api/localise', {
      neighbourhoods,
      bag,
      chapter,
    }),
  seed: (n = 20) => post<{ ok: boolean }>('/api/seed', { n }),
  reset: () => post<{ ok: boolean }>('/api/reset', {}),
}
