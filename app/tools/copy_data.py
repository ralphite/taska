"""Copy a Taska data folder: SQLite databases through the backup API (a consistent copy while it is in use), every
other file as it is. The source is only read.

    python3 app/tools/copy_data.py <from> <to>        (<to> must not exist)
"""

from __future__ import annotations

import os
import shutil
import sqlite3
import sys


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


def copy_tree(src: str, dst: str) -> None:
    os.makedirs(dst)
    for name in os.listdir(src):
        a, b = os.path.join(src, name), os.path.join(dst, name)
        if os.path.islink(a):
            raise SystemExit(f"refusing to copy a link: {a}")
        if os.path.isdir(a):
            copy_tree(a, b)
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
    copy_tree(src, dst)
    print(f"copied {src} -> {dst}")


if __name__ == "__main__":
    main()
