"""Import real data and compare it with the old app, project by project.

    python3 v2/tests/check_import.py /path/to/old/taska.py /path/to/a/COPY/of/the/data

For each project of the copy: the old app's Store replays taska.jsonl, v2 imports it into a scratch folder and replays
taska.db; both must show the same state and give agents the same text (every card, document, list, /next, /log).
The copy is only read; the import goes to a temporary folder.
"""

from __future__ import annotations

import importlib.util
import json
import os
import shutil
import sys
import tempfile
from typing import Any, Dict, List

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "server"))

from taska import importer, views  # noqa: E402
from taska.store import Store  # noqa: E402

VOLATILE = ("rev", "boot", "pv", "file", "agents", "work")


def load_old(path: str) -> Any:
    spec = importlib.util.spec_from_file_location("old_taska", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def norm(st: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in st.items() if k not in VOLATILE}


def compare(old_mod: Any, folder: str, tmp: str) -> List[str]:
    name = os.path.basename(folder)
    old = old_mod.Store(os.path.join(folder, "taska.jsonl"))
    old.name = name
    dst = os.path.join(tmp, name)
    importer.import_project(folder, dst, copy_files=False)
    os.symlink(os.path.join(folder, "taska-files"), os.path.join(dst, "taska-files")) if os.path.isdir(os.path.join(folder, "taska-files")) else None
    new = Store(dst, name=name)
    out: List[str] = []
    try:
        a, b = norm(old.state()), norm(new.state())
        if json.dumps(a, sort_keys=True, ensure_ascii=False) != json.dumps(b, sort_keys=True, ensure_ascii=False):
            for k in sorted(set(a) | set(b)):
                if json.dumps(a.get(k), sort_keys=True, ensure_ascii=False) != json.dumps(b.get(k), sort_keys=True, ensure_ascii=False):
                    out.append(f"state.{k} differs")
        texts = {"next": (old.next_text()[0], views.next_text(new)[0]), "inbox": (old.inbox(), views.inbox(new)),
                 "rules": (old.rules_text(), views.rules_text(new)), "log": (_safe(lambda: old.log(400)), views.log(new, 400)),
                 "items": (old.listing({"status": ["all"], "archived": ["all"], "limit": ["9999"]}), views.listing(new, {"status": ["all"], "archived": ["all"], "limit": ["9999"]}))}
        for n, it in old.items.items():
            texts[f"card {n}"] = (old.card(it), views.card(new, new.items[n]))
        for d in old.docs:
            texts[f"doc {d}"] = (old.doc_text(old.docs[d]), views.doc_text(new, new.docs[d]))
        for k, (x, y) in texts.items():
            if x is None:
                continue  # the old one fails there (a known bug): v2 answers
            x, y = x.replace(old.fdir, "<files>"), y.replace(new.fdir, "<files>")
            if x != y:
                out.append(f"{k} differs")
                if os.environ.get("SHOW"):
                    import difflib
                    print("\n".join(difflib.unified_diff(x.splitlines(), y.splitlines(), "old", "v2", lineterm="", n=1)))
    finally:
        new.close()
    return out


def _safe(fn: Any) -> Any:
    try:
        return fn()
    except Exception:
        return None


def main() -> None:
    old_mod = load_old(sys.argv[1])
    root = os.path.abspath(sys.argv[2])
    tmp = tempfile.mkdtemp(prefix="taska-import-check-")
    bad = 0
    try:
        for name in sorted(os.listdir(root)):
            folder = os.path.join(root, name)
            if not os.path.isfile(os.path.join(folder, "taska.jsonl")):
                continue
            problems = compare(old_mod, folder, tmp)
            bad += len(problems)
            print(f"{name}: {'same' if not problems else '; '.join(problems[:12])}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
