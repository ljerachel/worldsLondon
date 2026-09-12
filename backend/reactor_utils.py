"""Reactor-backed media generation, shared by app.py (Modal) and gen_assets.py (local).

Media paths:
- grab_still(): a Helios session is opened per asset and a frame is captured once
  the scene starts streaming; stills are pulled from real-time video.
- render_take(): drives reactor/ltx2 (photo + script -> lip-synced video+audio in
  one pass) and buffers the streamed frames/PCM.
- save_still() / encode_mp4(): Pillow crop + ffmpeg encode helpers.
"""

import asyncio
import pathlib
import subprocess
import wave

import numpy as np
from reactor_sdk import Reactor, ReactorStatus

HELIOS_MODEL = "reactor/helios"
LTX_MODEL = "reactor/ltx2"


async def grab_still(prompt: str, api_key: str, num_frames: int = 10,
                     timeout: float = 60.0) -> np.ndarray:
    """Open a Helios session, generate from `prompt`, return the last frame (RGB)."""
    reactor = Reactor(model_name=HELIOS_MODEL, api_key=api_key)
    frames: list[np.ndarray] = []

    @reactor.on_status(ReactorStatus.READY)
    async def _on_ready(_status):
        output = reactor.tracks.with_direction("recvonly").with_kind("video").one()
        output.on_frame(lambda frame: frames.append(frame))
        await reactor.send_command("set_prompt", {"prompt": prompt})
        await reactor.send_command("start", {})

    await reactor.connect()
    try:
        for _ in range(int(timeout * 10)):
            if len(frames) >= num_frames:
                break
            await asyncio.sleep(0.1)
    finally:
        await reactor.disconnect()
    if not frames:
        raise RuntimeError("helios produced no frames")
    return frames[-1]


def save_still(frame: np.ndarray, path: pathlib.Path, aspect: str = "9:16") -> None:
    """Centre-crop a landscape frame to a portrait aspect and save it."""
    from PIL import Image

    img = Image.fromarray(frame)
    w, h = img.size
    aw, ah = (int(x) for x in aspect.split(":"))
    if w * ah > h * aw:
        target_w, target_h = int(h * aw / ah), h
    else:
        target_w, target_h = w, int(w * ah / aw)
    left = (w - target_w) // 2
    top = (h - target_h) // 2
    img.crop((left, top, left + target_w, top + target_h)).save(path)


def fit_avatar(src_path: str, dst_path: pathlib.Path, size: tuple[int, int] = (640, 352)) -> None:
    """Letterbox a (usually portrait) photo onto LTX's 16:9 canvas over a blurred fill.

    LTX centre-crops whatever it receives to 640x352, which chops the head off a
    phone selfie, so fit the whole frame ourselves before uploading.
    """
    from PIL import Image, ImageFilter, ImageOps

    img = ImageOps.exif_transpose(Image.open(src_path)).convert("RGB")
    bg = ImageOps.fit(img, size).filter(ImageFilter.GaussianBlur(24))
    fg = ImageOps.contain(img, size)
    bg.paste(fg, ((size[0] - fg.width) // 2, (size[1] - fg.height) // 2))
    bg.save(dst_path, quality=92)


async def render_take(avatar_path: str, script: str, scene_prompt: str,
                      api_key: str, wpm: int = 150,
                      timeout: float = 90.0) -> tuple[list[np.ndarray], np.ndarray | None, int, int]:
    """Run one LTX take; returns (video_frames, pcm_int16, sample_rate, channels)."""
    fitted = pathlib.Path(avatar_path).with_name("avatar_16x9.jpg")
    fit_avatar(avatar_path, fitted)
    avatar_path = str(fitted)
    reactor = Reactor(model_name=LTX_MODEL, api_key=api_key)
    frames: list[np.ndarray] = []
    pcm: list[np.ndarray] = []
    audio_meta = {"sr": 48000, "ch": 2}
    done = asyncio.Event()
    errors: list[str] = []

    @reactor.on_message
    def _on_msg(msg):
        t = msg["type"]
        if t in ("generation_complete", "generation_stopped"):
            done.set()
        elif t in ("generation_failed", "command_error"):
            errors.append(f"{t}: {msg['data']}")
            done.set()

    @reactor.on_status(ReactorStatus.READY)
    async def _on_ready(_status):
        video = reactor.tracks.with_direction("recvonly").with_kind("video").one()
        audio = reactor.tracks.with_direction("recvonly").with_kind("audio").one()

        video.on_frame(lambda frame: frames.append(frame))

        @audio.on_frame
        def _on_audio(frame, sample_rate, num_channels):
            pcm.append(frame)
            audio_meta.update(sr=sample_rate, ch=num_channels)

        with open(avatar_path, "rb") as fh:
            ref = await reactor.upload_file(fh)
        await reactor.send_command("set_avatar_image", {"avatar_image": ref})
        await reactor.send_command("set_script", {"script": script})
        if scene_prompt:
            await reactor.send_command("set_prompt", {"prompt": scene_prompt})
        await reactor.send_command("set_wpm", {"wpm": wpm})
        await reactor.send_command("start", {})

    await reactor.connect()
    try:
        await asyncio.wait_for(done.wait(), timeout)
    finally:
        await reactor.disconnect()
    if errors:
        raise RuntimeError(errors[0])
    if not frames:
        raise RuntimeError("ltx produced no frames")
    audio = np.concatenate(pcm, axis=0).astype(np.int16) if pcm else None
    return frames, audio, audio_meta["sr"], audio_meta["ch"]


def encode_mp4(frames: list[np.ndarray], pcm: np.ndarray | None,
               sample_rate: int, num_channels: int,
               out_path: pathlib.Path, fps: int = 24) -> None:
    """Encode buffered RGB frames (+ optional PCM) to mp4 via ffmpeg."""
    h, w = frames[0].shape[:2]
    if pcm is not None and len(pcm):
        # LTX streams video below nominal rate; pace frames to the audio so they stay in sync.
        fps = max(1, round(len(frames) / (len(pcm) / sample_rate)))
    wav_path = out_path.with_suffix(".wav")
    cmd = ["ffmpeg", "-y",
           "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{w}x{h}", "-r", str(fps), "-i", "pipe:0"]
    if pcm is not None and len(pcm):
        with wave.open(str(wav_path), "wb") as wf:
            wf.setnchannels(num_channels)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(pcm.tobytes())
        cmd += ["-i", str(wav_path)]
    cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p"]
    if pcm is not None and len(pcm):
        cmd += ["-c:a", "aac", "-shortest"]
    cmd.append(str(out_path))
    raw = b"".join(np.ascontiguousarray(f).tobytes() for f in frames)
    proc = subprocess.run(cmd, input=raw, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {proc.stderr.decode()[-400:]}")
    wav_path.unlink(missing_ok=True)
