import asyncio
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

import reactor_utils


class FakeTrack:
    def __init__(self, kind):
        self.kind = kind
        self.callback = None

    def on_frame(self, callback):
        self.callback = callback
        return callback


class FakeTracks:
    def __init__(self, tracks):
        self._tracks = tracks
        self._kind = None

    def with_direction(self, direction):
        if direction != "recvonly":
            raise AssertionError(direction)
        return self

    def with_kind(self, kind):
        self._kind = kind
        return self

    def one(self):
        return self._tracks[self._kind]


class FakeReactor:
    instances = []

    def __init__(self, model_name, api_key):
        self.model_name = model_name
        self.api_key = api_key
        self.ready_handler = None
        self.message_handler = None
        self.commands = []
        self.disconnected = False
        self.video = FakeTrack("video")
        self.audio = FakeTrack("audio")
        self.tracks = FakeTracks({"video": self.video, "audio": self.audio})
        self.__class__.instances.append(self)

    def on_status(self, status):
        def decorate(callback):
            self.ready_handler = callback
            return callback
        return decorate

    def on_message(self, callback):
        self.message_handler = callback
        return callback

    async def connect(self):
        await self.ready_handler(reactor_utils.ReactorStatus.READY)

    async def disconnect(self):
        self.disconnected = True

    async def upload_file(self, file):
        self.uploaded = file.read()
        return {"id": "avatar-ref"}

    async def send_command(self, command, data):
        self.commands.append((command, data))
        if command == "start":
            frame = np.full((2, 3, 3), 7, dtype=np.uint8)
            self.video.callback(frame)
            if self.audio.callback:
                self.audio.callback(np.array([[1, 2]], dtype=np.int16), 48000, 2)
            if self.message_handler:
                self.message_handler({"type": "generation_complete", "data": {"seconds_sent": 1}})


class ReactorHelperTests(unittest.TestCase):
    def setUp(self):
        FakeReactor.instances.clear()

    def test_model_names_match_reactor_documentation(self):
        self.assertEqual(reactor_utils.HELIOS_MODEL, "reactor/helios")
        self.assertEqual(reactor_utils.LTX_MODEL, "reactor/ltx2")

    def test_save_still_crops_landscape_to_portrait_aspect(self):
        frame = np.zeros((6, 8, 3), dtype=np.uint8)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "still.png"
            reactor_utils.save_still(frame, path, aspect="3:4")
            with Image.open(path) as saved:
                self.assertEqual(saved.size, (4, 6))

    def test_save_still_centre_crops_height_when_source_is_too_narrow(self):
        rows = np.arange(6, dtype=np.uint8)[:, None, None]
        frame = np.broadcast_to(rows, (6, 4, 3)).copy()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "square.png"
            reactor_utils.save_still(frame, path, aspect="1:1")
            saved = np.asarray(Image.open(path))
            self.assertEqual(saved.shape[:2], (4, 4))
            self.assertEqual(saved[0, 0, 0], 1)
            self.assertEqual(saved[-1, 0, 0], 4)

    def test_grab_still_uses_helios_without_live_reactor(self):
        async def run():
            with patch.object(reactor_utils, "Reactor", FakeReactor):
                return await reactor_utils.grab_still("London at dusk", "test-key", num_frames=1)

        frame = asyncio.run(run())
        fake = FakeReactor.instances[-1]
        self.assertEqual(fake.model_name, "reactor/helios")
        self.assertEqual(fake.commands, [
            ("set_prompt", {"prompt": "London at dusk"}),
            ("start", {}),
        ])
        self.assertEqual(frame.shape, (2, 3, 3))
        self.assertTrue(fake.disconnected)

    def test_render_take_uses_ltx_commands_and_collects_media_without_live_reactor(self):
        async def run(avatar):
            with patch.object(reactor_utils, "Reactor", FakeReactor):
                return await reactor_utils.render_take(
                    str(avatar), "Hello London", "warm scene", "test-key", wpm=150
                )

        with tempfile.TemporaryDirectory() as directory:
            avatar = Path(directory) / "avatar.jpg"
            avatar.write_bytes(b"avatar")
            frames, pcm, sample_rate, channels = asyncio.run(run(avatar))

        fake = FakeReactor.instances[-1]
        self.assertEqual(fake.model_name, "reactor/ltx2")
        self.assertEqual(fake.uploaded, b"avatar")
        self.assertEqual(fake.commands, [
            ("set_avatar_image", {"avatar_image": {"id": "avatar-ref"}}),
            ("set_script", {"script": "Hello London"}),
            ("set_prompt", {"prompt": "warm scene"}),
            ("set_wpm", {"wpm": 150}),
            ("start", {}),
        ])
        self.assertEqual(len(frames), 1)
        np.testing.assert_array_equal(pcm, np.array([[1, 2]], dtype=np.int16))
        self.assertEqual((sample_rate, channels), (48000, 2))
        self.assertTrue(fake.disconnected)


if __name__ == "__main__":
    unittest.main()
