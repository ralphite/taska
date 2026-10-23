"""B494: the voice notes saved before Taska brought each one to the loudness of normal speech, brought there now.

Once, by hand: every voice note in every project is measured; one that is quieter than normal speech is brought up by
one amount (taska.voice.voice_level), in place. The original is copied first to the backup folder, so this can be
undone by copying the folder back.

    python3 v2/tools/voice_levels.py [--root ~/.taska] [--dry-run]
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "server"))
from taska.voice import voice_level, voice_mime  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="~/.taska")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    root = os.path.expanduser(a.root)
    backup = os.path.join(root, "backups", "voice-levels-" + time.strftime("%Y%m%d-%H%M"))
    seen = done = 0
    for project in sorted(os.listdir(root)):
        files = os.path.join(root, project, f"{project}-files")
        if not os.path.isdir(files):
            continue
        for fid in sorted(os.listdir(files)):
            mime = voice_mime(fid)
            if not mime or not fid.split("-", 1)[-1].startswith("voice"):
                continue
            seen += 1
            path = os.path.join(files, fid)
            with open(path, "rb") as f:
                data = f.read()
            out = voice_level(data, mime)
            if out is None:
                continue
            done += 1
            if a.dry_run:
                continue
            keep = os.path.join(backup, project, fid)
            os.makedirs(os.path.dirname(keep), exist_ok=True)
            shutil.copy2(path, keep)
            tmp = path + ".level"
            with open(tmp, "wb") as f:
                f.write(out)
            os.replace(tmp, path)
        print(f"{project}: {seen} voice notes so far, {done} brought up", flush=True)
    print(f"{seen} voice notes, {done} brought to the loudness of normal speech" +
          ("" if a.dry_run else f"; the originals are in {backup}"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
