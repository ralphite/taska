"""The backend's architecture rules (app/ARCHITECTURE.md), checked on the code.

    python3 -m unittest discover -s app/tests -p 'test_*.py'

Set TASKA_OLD_SRC to a checkout of the old version to also check that no file of it was copied here.
"""

from __future__ import annotations

import ast
import hashlib
import os
import re
import unittest
from typing import Dict, Iterator, List, Set, Tuple

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACKAGE = os.path.join(APP, "server", "taska")

# what each layer may import (besides itself and the standard library)
MAY_IMPORT: Dict[str, Set[str]] = {
    "domain": set(),
    "commands": {"domain"},
    "agent_text": {"domain"},
    "infra": {"domain"},
    "services": {"agent_text", "commands", "infra", "domain"},
    "page_api": {"services", "agent_text", "domain"},
    "http": {"page_api", "agent_text", "services", "infra", "domain"},
}
ROOTS = {"cli", "__main__", "__init__"}  # the composition root wires every layer

# standard modules that do I/O or keep threads: not in the pure layers
IO_MODULES = {"os", "sqlite3", "socket", "http", "threading", "urllib", "subprocess", "shutil", "tempfile", "io",
              "queue", "select", "signal", "logging"}
PURE: Dict[str, Set[str]] = {"domain": IO_MODULES, "commands": IO_MODULES - {"os"}, "agent_text": IO_MODULES}

MAX_LINES = 600
GENERATED = {os.path.join("agent_text", "guide_text.py"), os.path.join("agent_text", "organizer_text.py")}  # word lists


def read(path: str) -> str:
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def modules() -> Iterator[Tuple[str, str]]:
    for folder, _, files in os.walk(PACKAGE):
        for f in files:
            if f.endswith(".py"):
                path = os.path.join(folder, f)
                yield os.path.relpath(path, PACKAGE), path


def layer_of(rel: str) -> str:
    return rel.split(os.sep)[0].removesuffix(".py")


def imports(path: str, rel: str) -> List[Tuple[int, str, str]]:
    """(line, the package's top-level part it reaches, or "" for none; the standard module) for every import."""
    tree = ast.parse(read(path))
    here = rel.split(os.sep)[:-1]
    out: List[Tuple[int, str, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            if node.level:
                base = here[: len(here) - (node.level - 1)] if node.level > 1 else here
                parts = base + (node.module.split(".") if node.module else [])
                if not parts:  # "from .. import x" at the top: x is a layer
                    out += [(node.lineno, a.name, "") for a in node.names]
                else:
                    out.append((node.lineno, parts[0], ""))
            elif node.module:
                top = node.module.split(".")[0]
                out.append((node.lineno, node.module.split(".")[1] if top == "taska" else "", "" if top == "taska" else top))
        elif isinstance(node, ast.Import):
            for a in node.names:
                top = a.name.split(".")[0]
                out.append((node.lineno, a.name.split(".")[1] if top == "taska" and "." in a.name else "",
                            "" if top == "taska" else top))
    return out


class Layers(unittest.TestCase):
    def test_imports_go_down_the_layers(self) -> None:
        wrong: List[str] = []
        for rel, path in modules():
            layer = layer_of(rel)
            if layer in ROOTS:
                continue
            self.assertIn(layer, MAY_IMPORT, f"{rel}: not in a known layer")
            for line, reached, _ in imports(path, rel):
                if reached and reached != layer and reached not in MAY_IMPORT[layer]:
                    wrong.append(f"{rel}:{line} ({layer}) imports {reached}")
        self.assertEqual(wrong, [])

    def test_pure_layers_do_no_io(self) -> None:
        wrong: List[str] = []
        for rel, path in modules():
            banned = PURE.get(layer_of(rel))
            if banned is None:
                continue
            for line, _, std in imports(path, rel):
                if std in banned:
                    wrong.append(f"{rel}:{line} imports {std}")
        self.assertEqual(wrong, [])

    def test_one_way_into_the_log(self) -> None:
        """Only the store writes the file's log and state rows, and only a project's emit commits a change."""
        writers, committers = set(), set()
        for rel, path in modules():
            text = read(path)
            if re.search(r"\.db\.(append|write_state)\(", text):
                writers.add(rel)
            if re.search(r"\.store\.commit\(", text):
                committers.add(rel)
        self.assertEqual(writers, {os.path.join("services", "store.py")})
        self.assertEqual(committers, {os.path.join("services", "project.py")})

class Size(unittest.TestCase):
    def test_no_module_over_the_limit(self) -> None:
        big = [f"{rel}: {n} lines" for rel, path in modules()
               if (n := read(path).count("\n")) > MAX_LINES
               and rel not in GENERATED]
        self.assertEqual(big, [])


class Independence(unittest.TestCase):
    """app/ is its own project: it names nothing of the old one and holds no file copied from it."""

    OLD_NAMES = re.compile(r"""(['"/])v2/|taska\.py\b|\bv2\.server\b""")

    def files(self) -> Iterator[str]:
        for top in ("server", "web", "tools"):
            for folder, dirs, files in os.walk(os.path.join(APP, top)):
                dirs[:] = [d for d in dirs if d not in ("node_modules", "dist", "dist-storybook", "__pycache__",
                                                        "test-results", "playwright-report")]
                for f in files:
                    if f.endswith((".py", ".ts", ".tsx", ".mjs", ".js", ".json", ".html", ".css", ".sh")):
                        yield os.path.join(folder, f)

    def test_names_nothing_of_the_old_version(self) -> None:
        named = []
        for path in self.files():
            if path.endswith("package-lock.json"):
                continue
            for i, line in enumerate(read(path).split("\n"), 1):
                if self.OLD_NAMES.search(line):
                    named.append(f"{os.path.relpath(path, APP)}:{i}: {line.strip()[:100]}")
        self.assertEqual(named, [])

    def test_no_file_copied_from_the_old_version(self) -> None:
        old = os.environ.get("TASKA_OLD_SRC")
        if not old:
            self.skipTest("TASKA_OLD_SRC is not set")

        def digest(path: str) -> str:
            with open(path, "rb") as f:
                return hashlib.sha256(f.read()).hexdigest()

        theirs: Dict[str, str] = {}
        for folder, dirs, files in os.walk(old):
            dirs[:] = [d for d in dirs if d not in ("node_modules", "dist", ".git", "__pycache__")]
            for f in files:
                path = os.path.join(folder, f)
                if os.path.getsize(path) > 200 and not f.endswith((".png", ".ico")):
                    theirs[digest(path)] = os.path.relpath(path, old)
        same = [f"{os.path.relpath(p, APP)} = {theirs[d]}" for p in self.files() if (d := digest(p)) in theirs]
        self.assertEqual(same, [])


if __name__ == "__main__":
    unittest.main()
