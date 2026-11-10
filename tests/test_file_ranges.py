"""F747: a project's file is served in parts when asked (the Range header), as a video player asks for them: the
iPhone's plays a video only from a file served this way."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from support import ServerCase  # noqa: E402

DATA = bytes(range(256)) * 4  # 1024 bytes


class FileRanges(ServerCase):
    def upload(self) -> str:
        req = urllib.request.Request(self.p + "/api/file?name=clip.mp4", data=DATA, headers={"Content-Type": "video/mp4"})
        return json.loads(urllib.request.urlopen(req, timeout=10).read())["f"]

    def fetch(self, f: str, byte_range: str = ""):
        req = urllib.request.Request(self.p + "/f/" + f, headers={"Range": byte_range} if byte_range else {})
        try:
            return urllib.request.urlopen(req, timeout=10)
        except urllib.error.HTTPError as e:
            return e

    def test_whole_file_says_it_can_be_had_in_parts(self) -> None:
        r = self.fetch(self.upload())
        self.assertEqual(r.status, 200)
        self.assertEqual(r.headers["Accept-Ranges"], "bytes")
        self.assertEqual(r.headers["Content-Type"], "video/mp4")
        self.assertEqual(r.read(), DATA)

    def test_parts(self) -> None:
        f = self.upload()
        for asked, start, end in (("bytes=0-1", 0, 1), ("bytes=100-199", 100, 199), ("bytes=1000-", 1000, 1023),
                                  ("bytes=-24", 1000, 1023), ("bytes=1000-5000", 1000, 1023)):
            r = self.fetch(f, asked)
            self.assertEqual(r.status, 206, asked)
            self.assertEqual(r.headers["Content-Range"], f"bytes {start}-{end}/1024", asked)
            self.assertEqual(r.read(), DATA[start:end + 1], asked)

    def test_a_part_past_the_end_is_refused(self) -> None:
        r = self.fetch(self.upload(), "bytes=2000-")
        self.assertEqual(r.status, 416)
        self.assertEqual(r.headers["Content-Range"], "bytes */1024")

    def test_several_parts_at_once_get_the_whole_file(self) -> None:
        r = self.fetch(self.upload(), "bytes=0-1,5-6")
        self.assertEqual(r.status, 200)
        self.assertEqual(r.read(), DATA)
