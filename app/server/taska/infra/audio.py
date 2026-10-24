"""Voice note audio: its type from its name, and making a quiet note as loud as normal speech (with ffmpeg, when the
machine has it; without it the note is left as it is)."""

from __future__ import annotations

import mimetypes
import os
import re
import shutil
import subprocess
import tempfile
from typing import Optional

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
