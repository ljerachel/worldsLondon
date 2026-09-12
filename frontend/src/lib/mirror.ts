export const MIRROR_PROMPT =
  'dress the person in the video in the outfit and bag from the reference image, keep their face and pose, Coach campaign lighting'

export const MIRROR_LOOKS = ['Street confidence', 'Modern tailoring', 'After dark'] as const

export function lookBoardUrl(bag: string, index: number): string {
  return `/looks/${bag}-${index + 1}.png`
}

export async function fetchLookBoard(bag: string, index: number): Promise<Blob> {
  const response = await fetch(lookBoardUrl(bag, index))
  if (!response.ok) throw new Error(`Look board ${index + 1} could not be loaded`)
  return response.blob()
}

export function captureWebcamFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 720
  canvas.height = video.videoHeight || 1280
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Camera frame could not be captured'))
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Camera frame could not be encoded'))),
      'image/jpeg',
      0.86,
    )
  })
}
