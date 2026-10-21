"""F353: the width and height of a picture, read from its first bytes (PNG, JPEG, GIF, WebP), so the page can keep its
place before it loads and the text around it does not jump."""
from __future__ import annotations

import os
import struct
import threading
from typing import Dict, Optional, Tuple

Size = Tuple[int, int]
_SEEN: Dict[str, Tuple[float, Optional[Size]]] = {}
_LOCK = threading.Lock()
PICTURES = (".png", ".jpg", ".jpeg", ".gif", ".webp")


def size_of(data: bytes) -> Optional[Size]:
    """(width, height) from a picture's first bytes, or None when they are not a picture this knows."""
    if data[:8] == b"\x89PNG\r\n\x1a\n" and len(data) >= 24:
        w, h = struct.unpack(">II", data[16:24])
        return w, h
    if data[:6] in (b"GIF87a", b"GIF89a") and len(data) >= 10:
        w, h = struct.unpack("<HH", data[6:10])
        return w, h
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP" and len(data) >= 30:
        kind = data[12:16]
        if kind == b"VP8X":
            return 1 + int.from_bytes(data[24:27], "little"), 1 + int.from_bytes(data[27:30], "little")
        if kind == b"VP8 " and len(data) >= 30:
            w, h = struct.unpack("<HH", data[26:30])
            return w & 0x3FFF, h & 0x3FFF
        if kind == b"VP8L" and len(data) >= 25:
            b = int.from_bytes(data[21:25], "little")
            return (b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1
        return None
    if data[:2] == b"\xff\xd8":
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
                turned = _turned(data[i + 10:i + 2 + length])
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                h, w = struct.unpack(">HH", data[i + 5:i + 9])
                return (h, w) if turned else (w, h)  # a phone photo taken upright: shown turned, as browsers do
            i += 2 + length
    return None


def _turned(tiff: bytes) -> bool:
    """A JPEG's EXIF says it is shown a quarter turn round (orientation 5 to 8)."""
    if len(tiff) < 8 or tiff[:2] not in (b"II", b"MM"):
        return False
    e = "<" if tiff[:2] == b"II" else ">"
    try:
        at = struct.unpack(e + "I", tiff[4:8])[0]
        n = struct.unpack(e + "H", tiff[at:at + 2])[0]
        for k in range(n):
            tag = tiff[at + 2 + 12 * k:at + 14 + 12 * k]
            if struct.unpack(e + "H", tag[:2])[0] == 0x0112:
                return struct.unpack(e + "H", tag[8:10])[0] in (5, 6, 7, 8)
    except struct.error:
        return False
    return False


def sizes(folder: str) -> Dict[str, Size]:
    """Every picture in a project's files folder with its size; a file is read once until it changes."""
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
        with _LOCK:
            seen = _SEEN.get(path)
        if seen is None or seen[0] != mtime:
            try:
                with open(path, "rb") as f:
                    head = f.read(256 * 1024)  # a JPEG's size can sit after its thumbnail
            except OSError:
                continue
            seen = (mtime, size_of(head))
            with _LOCK:
                _SEEN[path] = seen
        if seen[1] and seen[1][0] > 0 and seen[1][1] > 0:
            out[name] = seen[1]
    return out
