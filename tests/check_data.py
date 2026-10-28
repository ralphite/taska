"""Read every project's durable log and replay it, without opening a writable database.

    python3 tests/check_data.py <data-root>

The check works on an SQLite backup or the live data root. It makes no requests, starts no jobs and changes no data.
"""

from __future__ import annotations

import argparse
from contextlib import closing
import json
import os
from pathlib import Path
import sqlite3
import sys
from typing import Dict, List, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))

from taska.domain.projection import replay  # noqa: E402
from taska.domain.vocab import PROJECT_NAME  # noqa: E402


def databases(root: Path) -> List[Path]:
    """Active and deleted projects, excluding links and unrelated databases."""
    out = []
    for parent in (root, root / ".deleted"):
        if not parent.is_dir() or parent.is_symlink():
            continue
        for folder in parent.iterdir():
            path = folder / "taska.db"
            if PROJECT_NAME.fullmatch(folder.name) and not folder.is_symlink() and path.is_file() and not path.is_symlink():
                out.append(path)
    return sorted(out)


def inspect(path: Path) -> Tuple[Dict[str, int], List[str]]:
    warnings: List[str] = []
    with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)) as db:
        db.execute("BEGIN")  # a single snapshot while a live project's log is changing
        checked = db.execute("PRAGMA quick_check").fetchall()
        if checked != [("ok",)]:
            warnings.append("SQLite integrity check failed")
        stored = db.execute("SELECT seq, data FROM events ORDER BY seq").fetchall()
    rows = []
    for expected, (seq, raw) in enumerate(stored, 1):
        if seq != expected:
            warnings.append(f"event sequence {seq}: expected {expected}")
        try:
            row = json.loads(raw)
            if not isinstance(row, dict):
                raise ValueError("not an object")
            rows.append(row)
        except (TypeError, ValueError):
            warnings.append(f"event {seq}: invalid JSON event")
    state = replay(rows, lambda seq, why: warnings.append(f"event {seq}: {why}"))
    return {"events": len(stored), "items": len(state.items), "inputs": len(state.inputs), "docs": len(state.docs)}, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    args = parser.parse_args()
    paths = databases(args.root.expanduser())
    if not paths:
        print("data check: no project databases found", file=sys.stderr)
        return 1
    total = 0
    failures = 0
    for path in paths:
        counts, warnings = inspect(path)
        total += counts["events"]
        failures += len(warnings)
        if warnings:
            print(f"{os.path.relpath(path, args.root)}: " + "; ".join(warnings), file=sys.stderr)
    print(f"data check: {len(paths)} projects, {total} events, {failures} errors")
    return int(bool(failures))


if __name__ == "__main__":
    sys.exit(main())
