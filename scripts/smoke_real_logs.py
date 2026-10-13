#!/usr/bin/env python3
"""Before a deploy: build every real project's page state and agent queue from a copy of its log, with this
checkout's taska.py. Fixtures miss shapes that only old, real logs have (a transcript event once broke every page).
Reads copies only; the data root is never written.
    python3 scripts/smoke_real_logs.py [DATA_ROOT]      # default ~/.taska
"""
import importlib.util
import os
import shutil
import sys
import tempfile
import traceback
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else "~/.taska").expanduser()
spec = importlib.util.spec_from_file_location("taska", Path(__file__).resolve().parents[1] / "taska.py")
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)

bad = 0
with tempfile.TemporaryDirectory() as tmp:
    for d in sorted(p for p in root.iterdir() if (p / "taska.jsonl").is_file()):
        os.makedirs(Path(tmp) / d.name)
        shutil.copy(d / "taska.jsonl", Path(tmp) / d.name / "taska.jsonl")
        try:
            s = taska.Store(str(Path(tmp) / d.name / "taska.jsonl"))
            s.name = d.name
            n = len(s.state()["items"])
            s.next_text()
            s.out.close()
            print(f"ok    {d.name}: {n} items")
        except Exception:
            bad += 1
            print(f"FAIL  {d.name}")
            traceback.print_exc()
print("all projects load" if not bad else f"{bad} project(s) fail to load")
sys.exit(1 if bad else 0)
