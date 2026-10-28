"""How big a picture is (width, height), read from its first bytes, so the page keeps a picture's place before it
loads and the words around it do not jump. PNG, GIF and WebP say it in their header; a JPEG says it in its frame
segment, and a photo its phone took upright says so in its EXIF (a quarter turn: width and height swap, as browsers
show it)."""

from __future__ import annotations

import os
import struct
import threading
from typing import Callable, Dict, Iterator, List, Optional, Tuple

Size = Tuple[int, int]
PICTURES = (".png", ".jpg", ".jpeg", ".gif", ".webp")
HEAD = 256 * 1024  # a JPEG's frame can come after its thumbnail


def _u(fmt: str, data: bytes, at: int) -> Tuple[int, ...]:
    return struct.unpack_from(fmt, data, at)


def _png(b: bytes) -> Optional[Size]:
    return (_u(">I", b, 16)[0], _u(">I", b, 20)[0]) if len(b) >= 24 else None


def _gif(b: bytes) -> Optional[Size]:
    return (_u("<H", b, 6)[0], _u("<H", b, 8)[0]) if len(b) >= 10 else None


def _webp(b: bytes) -> Optional[Size]:
    if len(b) < 30:
        return None
    chunk = b[12:16]
    if chunk == b"VP8X":  # extended: 24-bit width and height less one
        return 1 + int.from_bytes(b[24:27], "little"), 1 + int.from_bytes(b[27:30], "little")
    if chunk == b"VP8 ":  # lossy: 14 bits each, after the frame tag
        return _u("<H", b, 26)[0] & 0x3FFF, _u("<H", b, 28)[0] & 0x3FFF
    if chunk == b"VP8L":  # lossless: 14 bits each, less one, packed
        packed = int.from_bytes(b[21:25], "little")
        return 1 + (packed & 0x3FFF), 1 + (packed >> 14 & 0x3FFF)
    return None


def _segments(b: bytes) -> Iterator[Tuple[int, bytes]]:
    """A JPEG's segments, as (marker, what follows the length) until the frame; stray bytes are stepped over."""
    at = 2
    while at + 9 < len(b):
        if b[at] != 0xFF:
            at += 1
            continue
        marker = b[at + 1]
        if marker in (0x01, 0xD8) or 0xD0 <= marker <= 0xD7:  # markers with no length
            at += 2
            continue
        length = _u(">H", b, at + 2)[0]
        yield marker, b[at + 4:at + 2 + length]
        at += 2 + length


def _turned(exif: bytes) -> bool:
    """The EXIF orientation is one of the four that show the picture a quarter turn round (5 to 8)."""
    tiff = exif[6:]
    if len(tiff) < 8 or tiff[:2] not in (b"II", b"MM"):
        return False
    order = "<" if tiff[:2] == b"II" else ">"
    try:
        ifd = _u(order + "I", tiff, 4)[0]
        for k in range(_u(order + "H", tiff, ifd)[0]):
            tag, _, _, value = _u(order + "HHIH", tiff, ifd + 2 + 12 * k)
            if tag == 0x0112:
                return value in (5, 6, 7, 8)
    except struct.error:
        pass
    return False


def _jpeg(b: bytes) -> Optional[Size]:
    turned = False
    for marker, body in _segments(b):
        if marker == 0xE1 and body[:6] == b"Exif\0\0":
            turned = _turned(body)
        elif 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):  # a frame (not tables, not a reserved one)
            if len(body) < 5:
                return None
            height, width = _u(">HH", body, 1)
            return (height, width) if turned else (width, height)
    return None


READERS: List[Tuple[Callable[[bytes], bool], Callable[[bytes], Optional[Size]]]] = [
    (lambda b: b[:8] == b"\x89PNG\r\n\x1a\n", _png),
    (lambda b: b[:6] in (b"GIF87a", b"GIF89a"), _gif),
    (lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP", _webp),
    (lambda b: b[:2] == b"\xff\xd8", _jpeg),
]


def size_of(head: bytes) -> Optional[Size]:
    """(width, height), or None when the bytes are not a picture read here."""
    for looks, read in READERS:
        if looks(head):
            return read(head)
    return None


class PictureSizes:
    """The pictures of a folder with their sizes; each file is read again only once it changed."""

    def __init__(self) -> None:
        self._known: Dict[str, Tuple[float, Optional[Size]]] = {}
        self._lock = threading.Lock()

    def _size(self, path: str) -> Optional[Size]:
        try:
            changed = os.path.getmtime(path)
        except OSError:
            return None
        with self._lock:
            known = self._known.get(path)
        if known and known[0] == changed:
            return known[1]
        try:
            with open(path, "rb") as f:
                size = size_of(f.read(HEAD))
        except OSError:
            return None
        with self._lock:
            self._known[path] = (changed, size)
        return size

    def of_folder(self, folder: str) -> Dict[str, Size]:
        try:
            names = [n for n in os.listdir(folder) if n.lower().endswith(PICTURES)]
        except OSError:
            return {}
        sizes = {n: self._size(os.path.join(folder, n)) for n in names}
        return {n: s for n, s in sizes.items() if s and s[0] > 0 and s[1] > 0}
