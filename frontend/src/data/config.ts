export const NEIGHBOURHOODS = {
  shoreditch: { label: 'Shoreditch', lat: 51.5246, lng: -0.0776, cue: 'brick warehouses, street art, neon signs' },
  soho: { label: 'Soho', lat: 51.5136, lng: -0.1365, cue: 'narrow streets, theatre marquees, red lanterns, bars' },
  notting: { label: 'Notting Hill', lat: 51.509, lng: -0.1963, cue: 'pastel terraces, antique shopfronts, market stalls' },
  camden: { label: 'Camden', lat: 51.539, lng: -0.1426, cue: 'canal lock, market, punk shopfronts, bridges' },
  southbank: { label: 'South Bank', lat: 51.5066, lng: -0.1146, cue: 'riverside promenade, skateboarders, brutalist concrete, Thames' },
  peckham: { label: 'Peckham', lat: 51.4739, lng: -0.0692, cue: 'rooftop bar, rye lane shopfronts, buses, sunset' },
} as const

export const CHAPTERS = {
  firstday: { label: 'First day', mood: 'early morning golden light, empty streets, hopeful', line: "Tomorrow's the first day. I'm ready." },
  bignight: { label: 'Big night', mood: 'night, wet streets reflecting neon, buzzing', line: "Tonight I'm not asking permission." },
  sunday: { label: 'Quiet Sunday', mood: 'soft overcast light, coffee cups, slow', line: "No plans. That's the plan." },
  leaving: { label: 'Leaving town', mood: 'dusk, taxi headlights, suitcase, bittersweet', line: 'Some chapters you close on purpose.' },
  meeting: { label: 'Meeting someone', mood: 'blue hour, warm windows, anticipation', line: 'Ten minutes early. Heart already there.' },
} as const

export const BAGS = { tabby: 'Tabby', brooklyn: 'Brooklyn', empire: 'Empire' } as const // 3 looks each: /looks/{bag}-{1..3}.png

export type NeighbourhoodKey = keyof typeof NEIGHBOURHOODS
export type ChapterKey = keyof typeof CHAPTERS
export type BagKey = keyof typeof BAGS

export const COACH = { tan: '#B3894F', cream: '#F3EBDD', black: '#0a0a0a', red: '#8a1f2d' } as const
