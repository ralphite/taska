"""Copy a Taska data folder: SQLite databases through the backup API (a consistent copy while it is in use), every
other file as it is. Links are left out (a copy must never reach into the data it was copied from). The source is only
read.

    python3 tools/copy_data.py <from> <to>        (<to> must not exist)
"""

from __future__ import annotations

import os
import shutil
import sqlite3
import sys
from typing import List


def copy_db(src: str, dst: str) -> None:
    source = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    try:
        target = sqlite3.connect(dst)
        try:
            source.backup(target)
        finally:
            target.close()
    finally:
        source.close()


def copy_tree(src: str, dst: str, left_out: List[str]) -> None:
    os.makedirs(dst)
    for name in os.listdir(src):
        a, b = os.path.join(src, name), os.path.join(dst, name)
        if os.path.islink(a):
            left_out.append(a)
            continue
        if os.path.isdir(a):
            copy_tree(a, b, left_out)
        elif name.endswith(".db"):
            copy_db(a, b)
        elif name.endswith((".db-wal", ".db-shm")):
            continue  # the backup above holds what they held
        else:
            shutil.copy2(a, b)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    src, dst = (os.path.abspath(os.path.expanduser(p)) for p in sys.argv[1:])
    if os.path.exists(dst):
        raise SystemExit(f"{dst} exists already")
    left_out: List[str] = []
    copy_tree(src, dst, left_out)
    print(f"copied {src} -> {dst}" + (f", {len(left_out)} links left out" if left_out else ""))


if __name__ == "__main__":
    main()
