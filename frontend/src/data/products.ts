export const PRODUCTS = {
  tabby: { label: 'Tabby', imageUrl: '/products/tabby.webp', side: 'left' },
  brooklyn: { label: 'Brooklyn', imageUrl: '/products/brooklyn.webp', side: 'right' },
} as const

export type ProductKey = keyof typeof PRODUCTS

export const PORTAL_VIDEO_URL = '/immersive/portal.mp4'
export const WORLD_ANCHOR_URL = '/immersive/world-anchor.jpg'
