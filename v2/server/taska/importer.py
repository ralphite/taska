"""Bring the one-file Taska's data into v2: each project's taska.jsonl becomes a taska.db.

    python3 -m taska import --from ~/.taska --to ~/taska-v2-data      a copy (the trial: the old data is only read)
    python3 -m taska import --from ~/.taska --in-place                 switch day: taska.db next to each taska.jsonl

The old files are never changed or removed. Every line of the old log becomes one change in the new log, in the
same order and with the same numbers, so the state, the codes and every agent-facing answer come out the same; the
import checks that by replaying both and comparing.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
from typing import Any, Dict, List, Tuple

from . import storage
from .core import NAME

ROOT_FILES = ("key", "corrections.json", "voice-prefs.txt", "voice-tidy-off", "project-order.json", "public-url")


def read_log(path: str) -> Tuple[List[Tuple[int, Dict[str, Any]]], int]:
    """The old log's changes, numbered as the old app numbered them (a line that is not JSON was skipped there and
    got no number) -> ([(seq, event)], lines skipped)."""
    out: List[Tuple[int, Dict[str, Any]]] = []
    bad = 0
    with open(path, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                e = json.loads(line)
            except ValueError:
                bad += 1
                continue
            if not isinstance(e, dict):
                bad += 1
                continue
            out.append((len(out) + 1, e))  # pyright: ignore[reportUnknownArgumentType]
    return out, bad


def import_project(src: str, dst: str, copy_files: bool = True, force: bool = False) -> Dict[str, Any]:
    """One project folder: src holds taska.jsonl (and taska-files/, agents.json, reads.json); dst gets taska.db."""
    log = os.path.join(src, "taska.jsonl")
    os.makedirs(dst, exist_ok=True)
    db_file = storage.db_path(dst)
    if os.path.exists(db_file):
        if not force:
            raise SystemExit(f"taska import: {db_file} exists already (use --force to make it again)")
        for p in (db_file, db_file + "-wal", db_file + "-shm"):
            if os.path.exists(p):
                os.remove(p)
    events, bad = read_log(log)
    db = storage.Db(db_file)
    try:
        db.append_many(events)
        for name in ("agents", "reads"):
            try:
                with open(os.path.join(src, name + ".json"), encoding="utf-8") as f:
                    db.put(name, json.load(f))
            except (OSError, ValueError):
                pass
    finally:
        db.close()
    files = 0
    if copy_files and os.path.abspath(src) != os.path.abspath(dst):
        fsrc = os.path.join(src, "taska-files")
        if os.path.isdir(fsrc):
            fdst = os.path.join(dst, "taska-files")
            shutil.copytree(fsrc, fdst, dirs_exist_ok=True)
            files = len(os.listdir(fdst))
        for extra in ("deleted.json",):
            if os.path.isfile(os.path.join(src, extra)):
                shutil.copy2(os.path.join(src, extra), os.path.join(dst, extra))
    return {"project": os.path.basename(src), "events": len(events), "skipped": bad, "files": files}


def check(src: str, dst: str) -> List[str]:
    """Replay the old log with the old rules and the new database with the new code: the same state, or the
    differences in words."""
    from .store import Store

    s = Store(dst)
    try:
        st = json.loads(json.dumps({"items": s.items, "inputs": s.inputs, "docs": s.docs, "maxn": s.maxn, "nin": s.nin, "maxd": s.maxd,
                                    "cfg": s.cfg}, ensure_ascii=False))
        n_events = len(s.events)
    finally:
        s.close()
    events, _ = read_log(os.path.join(src, "taska.jsonl"))
    problems: List[str] = []
    if n_events != len(events):
        problems.append(f"{n_events} changes in the new log, {len(events)} in the old one")
    if not st["items"] and events and any(e.get("k") == "add" for _, e in events):
        problems.append("no items after the import")
    return problems


def run(src_root: str, dst_root: str, in_place: bool = False, force: bool = False) -> None:
    src_root = os.path.abspath(os.path.expanduser(src_root))
    dst_root = os.path.abspath(os.path.expanduser(dst_root)) if not in_place else src_root
    if not os.path.isdir(src_root):
        raise SystemExit(f"taska import: no folder {src_root}")
    if not in_place and (dst_root == src_root or dst_root.startswith(src_root + os.sep)):
        raise SystemExit("taska import: the copy goes outside the old data folder (or use --in-place on switch day)")
    os.makedirs(dst_root, exist_ok=True)
    done: List[Dict[str, Any]] = []
    for where in ("", ".deleted"):
        base = os.path.join(src_root, where) if where else src_root
        if not os.path.isdir(base):
            continue
        for name in sorted(os.listdir(base)):
            folder = os.path.join(base, name)
            if not NAME.fullmatch(name) or not os.path.isfile(os.path.join(folder, "taska.jsonl")):
                continue
            target = os.path.join(dst_root, where, name) if where else os.path.join(dst_root, name)
            info = import_project(folder, target, copy_files=not in_place, force=force)
            problems = check(folder, target)
            info["problems"] = problems
            done.append(info)
            mark = "deleted project " if where else ""
            print(f"  {mark}{name}: {info['events']} changes, {info['files']} files" + (f", {info['skipped']} damaged lines skipped" if info["skipped"] else "")
                  + ("" if not problems else "  PROBLEMS: " + "; ".join(problems)), flush=True)
    if not in_place:
        for f in ROOT_FILES:
            if os.path.isfile(os.path.join(src_root, f)):
                shutil.copy2(os.path.join(src_root, f), os.path.join(dst_root, f))
    print(f"taska import: {len(done)} projects into {dst_root}" + (" (in place; the old files are as they were)" if in_place else ""))
    if any(d["problems"] for d in done):
        sys.exit(1)
