"""Fresh copies of Yadong's data snapshot for the parity runs.

The snapshot (/Users/yadong/taska-rewrite/snapshot) is only read. A copy clones the whole tree at once (APFS
clonefile: real, separate files, made instantly; `cp -cR` where that fails) and then makes each SQLite database again through SQLite's backup
interface, read from the snapshot as an immutable file, so a database that something had open is still copied whole.
The -wal and -shm files are left out: the backup holds everything. Phone push subscriptions (.push) are left out, so a
copy never sends a push to Yadong's phone.

    python3 app/parity/data.py DST [SRC]      a fresh copy of the snapshot (or of SRC) in DST (DST must not exist)
"""

from __future__ import annotations

import ctypes
import os
import shutil
import sqlite3
import subprocess
import sys
import urllib.parse

SNAPSHOT = "/Users/yadong/taska-rewrite/snapshot"


def backup_db(src: str, dst: str) -> None:
    uri = "file:" + urllib.parse.quote(src) + "?mode=ro&immutable=1"
    s = sqlite3.connect(uri, uri=True)
    if os.path.exists(dst):
        os.remove(dst)
    d = sqlite3.connect(dst)
    try:
        s.backup(d)
    finally:
        d.close()
        s.close()


def copy_data(dst: str, src: str = SNAPSHOT) -> None:
    if os.path.exists(dst):
        raise SystemExit(f"{dst} exists already")
    os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
    # one clonefile(2) call clones the whole tree (APFS copy-on-write: separate files, made at once, and far less
    # work for the file-event and Spotlight services than thousands of single copies); cp -cR where it cannot
    libc = ctypes.CDLL("/usr/lib/libSystem.B.dylib", use_errno=True)
    if libc.clonefile(os.fsencode(src), os.fsencode(dst), 0) != 0:
        subprocess.run(["cp", "-cR", src, dst], check=True)
    for dirpath, _dirs, files in os.walk(dst):
        for f in files:
            p = os.path.join(dirpath, f)
            if f.endswith((".db-wal", ".db-shm")):
                os.remove(p)
            elif f.endswith(".db"):
                backup_db(os.path.join(src, os.path.relpath(p, dst)), p)
    # a copy never pushes to Yadong's phone: phone subscriptions stay with the real data
    shutil.rmtree(os.path.join(dst, ".push"), ignore_errors=True)
    links = [os.path.join(dp, x) for dp, ds, fs in os.walk(dst) for x in ds + fs if os.path.islink(os.path.join(dp, x))]
    if links:
        shutil.rmtree(dst)
        raise SystemExit(f"the copy has links, which must not be: {links[:3]}")


if __name__ == "__main__":
    copy_data(sys.argv[1], *sys.argv[2:3])
