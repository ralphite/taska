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

from taska.domain.projection import apply, replay  # noqa: E402
from taska.domain.state import ProjectState  # noqa: E402
from taska.domain.vocab import PROJECT_NAME  # noqa: E402
from taska.domain.voice_split import copies_in, plan  # noqa: E402
from taska.domain.voices import voices_of  # noqa: E402
from taska.domain import events as ev, rules_move, versions  # noqa: E402


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
    split = voices(path, state, rows, warnings)
    moved = rules_doc(state, rows, warnings)
    return {"events": len(stored), "items": len(state.items), "inputs": len(state.inputs), "docs": len(state.docs),
            "voices": len(state.voices), "split": split, "rules": moved}, warnings


def rules_doc(state: ProjectState, rows: List[dict], warnings: List[str]) -> int:
    """I693: every rule in force landed in the rules document's version 1 word for word, a rule waiting for the user
    is a proposal on it, and no rule item is left. A project not moved yet is moved here in memory, as the server does
    once when it opens it. -> rule items moved here (0: none, or moved before)."""
    at = next((i for i, r in enumerate(rows) if r.get("k") == "rulesmoved"), None)
    if at is None:
        before, changes = state, rules_move.plan(state, "check")
        for e in changes:
            apply(state, e)
    else:  # the state just before the move: the first of its changes is version 1 (or a proposal, or the move)
        first = at
        while first > 0 and (rows[first - 1].get("k") == "dprop" or (
                rows[first - 1].get("k") == "doc" and rows[first - 1].get("why") == rules_move.WHY)):
            first -= 1
        before = replay(rows[:first], lambda seq, why: None)
        changes = []
    force, wait = rules_move.in_force(before), rules_move.waiting(before)
    d = state.rules
    v1 = versions.versions(state, d)[0].md if d and versions.versions(state, d) else ""
    for it in force:
        if rules_move.section(it) not in v1:
            warnings.append(f"rule {it.n} ({it.title[:40]}) is not in the rules' version 1 word for word")
    proposed = {p.why for p in (d.proposals if d else [])}
    for it in wait:
        if " ".join(it.title.split()) not in proposed:
            warnings.append(f"rule {it.n} waiting for the user is not a proposal on the rules")
    left = [n for n, i in state.items.items() if i.type == "rule"]
    if left:
        warnings.append(f"{len(left)} rule items left: {left[:5]}")
    gone = next((e for e in changes if isinstance(e, ev.RulesMoved)), None)
    return len(gone.ns) if gone else 0


def voices(path: Path, state: ProjectState, rows: List[dict], warnings: List[str]) -> int:
    """B682: every voice note has its one record of words. A project not split yet is split here in memory, as the
    server does once when it opens it (what was kept next to the audio is only read). -> texts it would change."""
    changed = 0
    if not state.voices_split:
        kept = {}
        for side in (path.parent / "taska-files").glob("*.tr.json"):
            try:
                kept[side.name[: -len(".tr.json")]] = json.loads(side.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                warnings.append(f"{side.name}: unreadable words")
        event, _ = plan(state, kept, copies_in(rows), "check")
        changed = len(event.inputs) + sum(len(c) for c in event.comments.values())
        apply(state, event)
    files = [f for i in state.inputs.values() for f in i.files] + \
        [f for d in state.docs.values() for c in d.comments + list(d.gone.values()) for f in c.files]
    lacking = sorted({f.f for f in voices_of(files) if f.f not in state.voices})
    if lacking:
        warnings.append(f"{len(lacking)} voice notes without a record of their words: {' '.join(lacking[:5])}")
    return changed


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
    voiced = split = moved = 0
    for path in paths:
        counts, warnings = inspect(path)
        total += counts["events"]
        voiced += counts["voices"]
        split += counts["split"]
        moved += counts["rules"]
        failures += len(warnings)
        if warnings:
            print(f"{os.path.relpath(path, args.root)}: " + "; ".join(warnings), file=sys.stderr)
    print(f"data check: {len(paths)} projects, {total} events, {voiced} voice notes with their words"
          f"{f' ({split} texts to split once)' if split else ''}"
          f"{f', {moved} rule items to move into the rules once' if moved else ''}, {failures} errors")
    return int(bool(failures))


if __name__ == "__main__":
    sys.exit(main())
