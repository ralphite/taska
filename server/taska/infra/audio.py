"""Voice note audio: its type from its name, making a quiet note as loud as normal speech, telling a phone's processed
recording (afconvert), cutting a note at its pauses, its length (ffmpeg and ffprobe, when the machine has them;
without them these steps are skipped)."""

from __future__ import annotations

import array
import io
import math
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave
from typing import List, Optional, Tuple

AUDIO_MIME = {".webm": "audio/webm", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".mp4": "audio/mp4", ".mp3": "audio/mpeg",
              ".wav": "audio/wav", ".aac": "audio/aac", ".flac": "audio/flac"}
AUDIO_EXT = {"audio/mp4": ".m4a", "audio/x-m4a": ".m4a", "audio/m4a": ".m4a", "audio/aac": ".aac", "audio/mpeg": ".mp3",
             "audio/ogg": ".ogg", "audio/wav": ".wav", "audio/webm": ".webm"}
PEAK = -1.0  # dB: where the loudest moment goes
MIN_GAIN = 3.0  # dB: less than this and it is left alone
MAX_GAIN = 30.0  # dB: never more, so a hum is not made a roar


def audio_type(fid: str) -> str:
    """The audio type of an uploaded voice note, by its name; "" for anything else."""
    mime = AUDIO_MIME.get(os.path.splitext(fid)[1].lower()) or \
        (mimetypes.guess_type(fid)[0] or "").replace("video/webm", "audio/webm")
    return mime if mime.startswith("audio/") else ""


def _encoding(kind: str) -> Optional[tuple]:
    if kind == "audio/webm":
        return "webm", ["-c:a", "libopus", "-b:a", "96k"]
    if kind in ("audio/mp4", "audio/x-m4a", "audio/m4a"):
        return "mp4", ["-c:a", "aac", "-b:a", "128k"]
    return None


def leveled(data: bytes, mime: str) -> Optional[bytes]:
    """The note at the loudness of normal speech, in the same format; None when it is loud enough already, silent,
    of another format, or there is no ffmpeg."""
    tool = shutil.which("ffmpeg")
    kind = mime.split(";")[0]
    enc = _encoding(kind)
    if not tool or not enc:
        return None
    with tempfile.TemporaryDirectory() as d:
        src, out = os.path.join(d, "in" + AUDIO_EXT.get(kind, ".webm")), os.path.join(d, "out." + enc[0])
        try:
            with open(src, "wb") as f:
                f.write(data)
            probe = subprocess.run([tool, "-hide_banner", "-i", src, "-af", "volumedetect", "-f", "null", "-"],
                                   capture_output=True, text=True, timeout=60)
            m = re.search(r"max_volume: (-?[\d.]+) dB", probe.stderr)
            if not m or float(m.group(1)) < -60:  # silence
                return None
            gain = min(PEAK - float(m.group(1)), MAX_GAIN)
            if gain < MIN_GAIN:
                return None
            subprocess.run([tool, "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-af", f"volume={gain:.1f}dB",
                            *enc[1], "-f", enc[0], out], capture_output=True, timeout=120, check=True)
            with open(out, "rb") as f:
                return f.read() or None
        except (OSError, subprocess.SubprocessError, ValueError):
            return None


def processed_silence(path: Optional[str], mime: str) -> float:
    """Seconds of exact digital silence inside the speech of a recording macOS can decode (an iPhone's m4a): the mark
    of a phone's voice processing. 0.0 when there is none, or when this machine cannot tell (no afconvert)."""
    tool = shutil.which("afconvert")
    if not tool or not path or mime.split(";")[0] not in ("audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/mpeg"):
        return 0.0
    fd, wav = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        subprocess.run([tool, "-f", "WAVE", "-d", "LEI16@16000", "-c", "1", path, wav], capture_output=True, timeout=60, check=True)
        with open(wav, "rb") as f:
            raw = f.read()
    except (OSError, subprocess.SubprocessError):
        return 0.0
    finally:
        try:
            os.unlink(wav)
        except OSError:
            pass
    pos, data = 12, b""  # the samples are in the "data" chunk (Python 3.9's wave cannot read the header afconvert writes)
    while pos + 8 <= len(raw):
        size = int.from_bytes(raw[pos + 4:pos + 8], "little")
        if raw[pos:pos + 4] == b"data":
            data = raw[pos + 8:pos + 8 + size]
            break
        pos += 8 + size + (size & 1)
    a = array.array("h", data[:min(len(data) // 2, 16000 * 600) * 2])  # ten minutes is plenty to tell
    if sys.byteorder == "big":
        a.byteswap()
    n = 800  # 50 ms
    frames = [a[i:i + n] for i in range(0, len(a) - n + 1, n)]
    db = [20 * math.log10(max(1.0, math.sqrt(sum(v * v for v in f) / n)) / 32768) for f in frames]
    if not db:
        return 0.0
    top = sorted(db)[-max(1, len(db) // 20)]  # the loud end of the note, not one click
    voiced = [i for i, d in enumerate(db) if d > max(-60.0, top - 40)]
    if not voiced:
        return 0.0
    return sum(1 for f in frames[voiced[0]:voiced[-1] + 1] if not any(f)) * 0.05


def louder(data: bytes, mime: str) -> Optional[bytes]:
    """B494: a note spoken far from the microphone, so quiet the speech model hears nobody: brought up to the loudness
    of normal speech (ffmpeg's loudnorm), as Opus in WebM. None when there is no sound in it at all, or no ffmpeg."""
    tool = shutil.which("ffmpeg")
    if not tool:
        return None
    with tempfile.TemporaryDirectory() as d:
        src, out = os.path.join(d, "in" + AUDIO_EXT.get(mime.split(";")[0], ".webm")), os.path.join(d, "out.webm")
        try:
            with open(src, "wb") as f:
                f.write(data)
            r = subprocess.run([tool, "-hide_banner", "-i", src, "-af", "volumedetect", "-f", "null", "-"], capture_output=True,
                               text=True, timeout=60)
            m = re.search(r"max_volume: (-?[\d.]+) dB", r.stderr)
            if not m or float(m.group(1)) < -45:  # silence, or nothing above a breath: nothing was said
                return None
            subprocess.run([tool, "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-af", "loudnorm=I=-18:TP=-2", "-c:a",
                            "libopus", out], capture_output=True, timeout=120, check=True)
            with open(out, "rb") as f:
                return f.read() or None
        except (OSError, subprocess.SubprocessError, ValueError):
            return None


def pieces(path: Optional[str], most: int = 12) -> Tuple[List[bytes], float]:
    """B277: a recording cut at its pauses into pieces of up to about 8 s, as 16 kHz mono WAV bytes -> (pieces, seconds).
    Needs ffmpeg; ([], 0) without it. On some iPhone notes the models keep only the first phrase of the whole note,
    yet hear each quiet later phrase when it comes alone."""
    tool = shutil.which("ffmpeg")
    if not tool or not path:
        return [], 0.0
    try:
        raw = subprocess.run([tool, "-v", "quiet", "-i", path, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, timeout=60).stdout
    except (OSError, subprocess.SubprocessError):
        return [], 0.0
    a = array.array("h", raw[:len(raw) // 2 * 2])
    if sys.byteorder == "big":
        a.byteswap()
    n, secs = 800, len(a) / 16000  # 50 ms frames
    db = [20 * math.log10(max(1.0, math.sqrt(sum(v * v for v in a[i:i + n]) / n)) / 32768) for i in range(0, len(a) - n + 1, n)]
    if not db:
        return [], secs
    floor = sorted(db)[len(db) // 5]  # the room's own level
    loud = [d > max(floor + 12, -52) for d in db]
    spans, start, quiet = [], None, 0
    for i, on in enumerate(loud + [False] * 8):
        if on:
            start = i if start is None else start
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet >= 7 or i >= len(loud):  # a pause of 350 ms ends a phrase
                spans.append((start, i - quiet + 1))
                start, quiet = None, 0
    pieces = []
    for s0, s1 in spans:  # phrases joined into pieces of up to 8 s, each with a little room around it
        if pieces and s1 - pieces[-1][0] <= 160:
            pieces[-1][1] = s1
        else:
            pieces.append([s0, s1])
    out = []
    for s0, s1 in pieces[:most]:
        if s1 - s0 < 4:  # under 200 ms: a click
            continue
        b0, b1 = max(0, (s0 - 4) * n), min(len(a), (s1 + 4) * n)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(a[b0:b1].tobytes())
        out.append(buf.getvalue())
    return out, secs


def duration(path: Optional[str]) -> float:
    """A recording's length in seconds (ffprobe), or 0 when it cannot be told."""
    if not path:
        return 0.0
    try:
        out = subprocess.run([shutil.which("ffprobe") or "ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                             capture_output=True, timeout=20).stdout
        return float(out or 0)
    except (OSError, ValueError, subprocess.SubprocessError):
        return 0.0
