// Reactor X2 ("reactor/x2") — live reference-guided video transformation.
// The mirror: webcam in → re-rendered out wearing the look-board outfit/bag.
//
// Prefer the React wiring from the SDK (see components/Mirror.tsx):
//   <ReactorProvider modelName="reactor/x2" jwtToken={jwt}>
//     <WebcamStream track="source" showWebcam={false}
//       videoConstraints={{ facingMode: 'user', width: 720, height: 1280 }} />
//     <ReactorView track="main_video" videoObjectFit="cover" />
//   </ReactorProvider>
// then (via useReactor()):
//   const ref = await uploadFile(lookBoardFile)
//   await sendCommand('set_reference_image', { reference_image: ref })
//   await sendCommand('set_prompt', { prompt: MIRROR_PROMPT })
// Swipe to the next look = set_reference_image(nextBoard) (auto-restarts stream).
// Schema: docs.reactor.inc/model-api-reference/x2/schema.md

export const MIRROR_PROMPT =
  'dress the person in the video in the outfit and bag from the reference image, keep their face and pose, Coach campaign lighting'

export function lookBoardUrl(bag: string, index: number): string {
  return `/looks/${bag}-${index + 1}.png`
}
