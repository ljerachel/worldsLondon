// TODO (Builder C — ticket T6): X2 mirror screen.
// <ReactorProvider modelName="reactor/x2" jwtToken={jwt}> +
// <WebcamStream track="source" showWebcam={false} videoConstraints={front camera} /> +
// <ReactorView track="main_video" videoObjectFit="cover" className="h-full w-full" />.
// On ready: upload lookBoardUrl(bag, lookIndex) → set_reference_image → set_prompt(MIRROR_PROMPT).
// Swipe → next look; ♥ → api.sendEvent(id, 'save', index).
// Auto-selfie after 3s: webcam frame → canvas → JPEG → api.uploadSelfie.
// 8s no-frame fallback: webcam + look board PiP + "Try in store".
export default function Mirror() {
  return null
}
