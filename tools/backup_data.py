"""Keep a daily copy of Taska's data (T582, D103 #1): the databases through SQLite's backup API (consistent while in
use), every other file copied, or hard-linked to yesterday's copy when it has not changed (attachments never change,
so 14 days cost little more than one). The last 14 copies are kept, outside the data folder.
    python3 tools/backup_data.py [<data> [<backups>]]      defaults: ~/.taska, ~/.taska-backups
"""

from __future__ import annotations

import datetime
import os
import shutil
import sys
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from copy_data import copy_db  # noqa: E402

KEEP = 14


def same(a: str, b: Optional[str]) -> bool:
    if not b or not os.path.isfile(b):
        return False
    x, y = os.stat(a), os.stat(b)
    return x.st_size == y.st_size and int(x.st_mtime) == int(y.st_mtime)


def copy_tree(src: str, dst: str, prev: Optional[str]) -> None:
    os.makedirs(dst)
    for name in os.listdir(src):
        a, b = os.path.join(src, name), os.path.join(dst, name)
        p = os.path.join(prev, name) if prev else None
        if os.path.islink(a):
            continue
        if os.path.isdir(a):
            copy_tree(a, b, p if p and os.path.isdir(p) else None)
        elif name.endswith(".db"):
            copy_db(a, b)
        elif name.endswith((".db-wal", ".db-shm")):
            continue  # the backup above holds what they held
        elif same(a, p):
            os.link(p, b)  # type: ignore[arg-type]
        else:
            shutil.copy2(a, b)


def backup(data: str, backups: str, today: str) -> str:
    os.makedirs(backups, exist_ok=True)
    days = sorted(d for d in os.listdir(backups) if not d.startswith("."))
    dst = os.path.join(backups, today)
    if today in days:
        return dst  # once a day
    tmp = os.path.join(backups, "." + today)
    shutil.rmtree(tmp, ignore_errors=True)
    copy_tree(data, tmp, os.path.join(backups, days[-1]) if days else None)
    os.rename(tmp, dst)
    for old in (days + [today])[:-KEEP]:
        shutil.rmtree(os.path.join(backups, old), ignore_errors=True)
    return dst


def main() -> None:
    args = [os.path.abspath(os.path.expanduser(p)) for p in sys.argv[1:]]
    data = args[0] if args else os.path.expanduser("~/.taska")
    backups = args[1] if len(args) > 1 else os.path.expanduser("~/.taska-backups")
    print("backed up to", backup(data, backups, datetime.date.today().isoformat()))


if __name__ == "__main__":
    main()
