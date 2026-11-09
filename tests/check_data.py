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
from taska.domain.state import ProjectState  # noqa: E402
from taska.domain.vocab import PROJECT_NAME  # noqa: E402
from taska.domain.voices import voices_of  # noqa: E402
from taska.domain import events as ev  # noqa: E402
from taska.infra.project_db import FORMAT_VERSION  # noqa: E402


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
        version = db.execute("SELECT v FROM meta WHERE k = 'version'").fetchone()
    if not version or version[0] != FORMAT_VERSION:
        warnings.append(f"its log is in format {version[0] if version else '?'}, not {FORMAT_VERSION}")
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
    unknown = sorted({e.kind for e in state.events if isinstance(e, ev.Unknown)})
    if unknown:
        warnings.append(f"changes of kinds this version does not know: {' '.join(unknown)}")
    voices(state, warnings)
    rules = [n for n, i in state.items.items() if i.type == "rule"]
    if rules:  # the rules are one document (I693)
        warnings.append(f"{len(rules)} rule items: {rules[:5]}")
    return {"events": len(stored), "items": len(state.items), "inputs": len(state.inputs), "docs": len(state.docs),
            "voices": len(state.voices)}, warnings


def voices(state: ProjectState, warnings: List[str]) -> None:
    """B682: every voice note has its one record of words."""
    files = [f for i in state.inputs.values() for f in i.files] + \
        [f for d in state.docs.values() for c in d.comments + list(d.gone.values()) for f in c.files]
    lacking = sorted({f.f for f in voices_of(files) if f.f not in state.voices})
    if lacking:
        warnings.append(f"{len(lacking)} voice notes without a record of their words: {' '.join(lacking[:5])}")


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
    voiced = 0
    for path in paths:
        counts, warnings = inspect(path)
        total += counts["events"]
        voiced += counts["voices"]
        failures += len(warnings)
        if warnings:
            print(f"{os.path.relpath(path, args.root)}: " + "; ".join(warnings), file=sys.stderr)
    print(f"data check: {len(paths)} projects, {total} events, {voiced} voice notes with their words, {failures} errors")
    return int(bool(failures))


if __name__ == "__main__":
    sys.exit(main())
