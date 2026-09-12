import { Reactor } from '@reactor-team/js-sdk'

// LingBot World 2 ("reactor/lingbot-world-2") — image-anchored navigable world.
// Requires set_image + set_prompt BEFORE start. Steering commands are persistent
// until changed — send "idle" to stop. Verify enum values against
// docs.reactor.inc/model-api-reference/lingbot-world-2/schema.md if controls misbehave.

export type MoveDir = 'forward' | 'back' | 'idle'
export type StrafeDir = 'strafe_left' | 'strafe_right' | 'idle'
export type LookDir = 'left' | 'right' | 'idle'

export interface WorldHandle {
  move: (dir: MoveDir) => void
  strafe: (dir: StrafeDir) => void
  look: (dir: LookDir) => void
  steer: (prompt: string) => void
  close: () => Promise<void>
}

export async function openWorld(opts: {
  jwt: string
  anchorUrl: string
  prompt: string
  videoEl: HTMLVideoElement
  onFirstFrame?: () => void
  onLatency?: (ms: number) => void
}): Promise<WorldHandle> {
  const { jwt, anchorUrl, prompt, videoEl, onFirstFrame, onLatency } = opts
  const reactor = new Reactor({ modelName: 'reactor/lingbot-world-2' })

  let lastSent = 0
  const send = (command: string, data: Record<string, unknown>) => {
    lastSent = performance.now()
    void reactor.sendCommand(command, data)
  }

  try {
    let firstFrame = false
    reactor.on('trackReceived', (name: string, track: MediaStreamTrack) => {
      if (name !== 'main_video') return
      videoEl.srcObject = new MediaStream([track])
      void videoEl.play()
      if (onLatency && lastSent) onLatency(performance.now() - lastSent)
      if (!firstFrame) {
        firstFrame = true
        onFirstFrame?.()
      }
    })

    await reactor.connect(jwt)

    // Anchor image must be a File — fetch the pre-generated still and upload it.
    const blob = await (await fetch(anchorUrl)).blob()
    const file = new File([blob], 'anchor.png', { type: blob.type || 'image/png' })
    const ref = await reactor.uploadFile(file)
    await reactor.sendCommand('set_image', { image: ref })
    await reactor.sendCommand('set_prompt', { prompt })
    await reactor.sendCommand('set_rotation_speed_deg', { rotation_speed_deg: 1 })
    await reactor.sendCommand('start', {})
  } catch (error) {
    try {
      await reactor.disconnect()
    } catch {}
    throw error
  }

  return {
    move: (dir) => send('set_move_longitudinal', { move_longitudinal: dir }),
    strafe: (dir) => send('set_move_lateral', { move_lateral: dir }),
    look: (dir) => send('set_look_horizontal', { look_horizontal: dir }),
    steer: (p) => send('set_prompt', { prompt: p }),
    close: () => reactor.disconnect(),
  }
}
