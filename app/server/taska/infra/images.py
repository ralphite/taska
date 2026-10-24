"""The width and height of a picture, read from its first bytes (PNG, GIF, WebP, JPEG), so the page keeps its place
before a picture loads and the text around it does not jump."""

from __future__ import annotations

import os
import struct
import threading
from typing import Dict, Optional, Tuple

Size = Tuple[int, int]
PICTURES = (".png", ".jpg", ".jpeg", ".gif", ".webp")


def _png(data: bytes) -> Optional[Size]:
    if data[:8] == b"\x89PNG\r\n\x1a\n" and len(data) >= 24:
        w, h = struct.unpack(">II", data[16:24])
        return w, h
    return None


def _gif(data: bytes) -> Optional[Size]:
    if data[:6] in (b"GIF87a", b"GIF89a") and len(data) >= 10:
        w, h = struct.unpack("<HH", data[6:10])
        return w, h
    return None


def _webp(data: bytes) -> Optional[Size]:
    kind = data[12:16]
    if kind == b"VP8X":
        return 1 + int.from_bytes(data[24:27], "little"), 1 + int.from_bytes(data[27:30], "little")
    if kind == b"VP8 " and len(data) >= 30:
        w, h = struct.unpack("<HH", data[26:30])
        return w & 0x3FFF, h & 0x3FFF
    if kind == b"VP8L" and len(data) >= 25:
        bits = int.from_bytes(data[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    return None


def _quarter_turn(tiff: bytes) -> bool:
    """A JPEG's EXIF says it shows a quarter turn round (orientation 5 to 8)."""
    if len(tiff) < 8 or tiff[:2] not in (b"II", b"MM"):
        return False
    order = "<" if tiff[:2] == b"II" else ">"
    try:
        at = struct.unpack(order + "I", tiff[4:8])[0]
        count = struct.unpack(order + "H", tiff[at:at + 2])[0]
        for k in range(count):
            entry = tiff[at + 2 + 12 * k:at + 14 + 12 * k]
            if struct.unpack(order + "H", entry[:2])[0] == 0x0112:
                return struct.unpack(order + "H", entry[8:10])[0] in (5, 6, 7, 8)
    except struct.error:
        return False
    return False


def _jpeg(data: bytes) -> Optional[Size]:
    i, turned = 2, False
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        length = struct.unpack(">H", data[i + 2:i + 4])[0]
        if marker == 0xE1 and data[i + 4:i + 10] == b"Exif\0\0":
            turned = _quarter_turn(data[i + 10:i + 2 + length])
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            h, w = struct.unpack(">HH", data[i + 5:i + 9])
            return (h, w) if turned else (w, h)  # a phone photo taken upright shows turned, as browsers do
        i += 2 + length
    return None


def size_of(data: bytes) -> Optional[Size]:
    """(width, height), or None when the bytes are not a picture this reads."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return _png(data)
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return _gif(data)
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return _webp(data) if len(data) >= 30 else None
    if data[:2] == b"\xff\xd8":
        return _jpeg(data)
    return None


class PictureSizes:
    """Every picture in a folder with its size; a file is read again only when it changed."""

    def __init__(self) -> None:
        self._seen: Dict[str, Tuple[float, Optional[Size]]] = {}
        self._lock = threading.Lock()

    def of_folder(self, folder: str) -> Dict[str, Size]:
        out: Dict[str, Size] = {}
        try:
            names = os.listdir(folder)
        except OSError:
            return out
        for name in names:
            if not name.lower().endswith(PICTURES):
                continue
            path = os.path.join(folder, name)
            try:
                mtime = os.path.getmtime(path)
            except OSError:
                continue
            with self._lock:
                seen = self._seen.get(path)
            if seen is None or seen[0] != mtime:
                try:
                    with open(path, "rb") as f:
                        head = f.read(256 * 1024)  # a JPEG's size can sit after its thumbnail
                except OSError:
                    continue
                seen = (mtime, size_of(head))
                with self._lock:
                    self._seen[path] = seen
            if seen[1] and seen[1][0] > 0 and seen[1][1] > 0:
                out[name] = seen[1]
        return out
