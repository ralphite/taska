"""The backend's architecture rules (docs/architecture.md), checked on the code.

    python3 -m unittest discover -s tests -p 'test_*.py'
"""

from __future__ import annotations

import ast
import os
import re
import unittest
from typing import Dict, Iterator, List, Set, Tuple

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACKAGE = os.path.join(ROOT, "server", "taska")

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


class ProjectLayout(unittest.TestCase):
    """Source, tests and operational entry points form one self-contained project."""

    def test_one_source_tree(self) -> None:
        for name in ("server", "web", "tests", "tools", "docs"):
            self.assertTrue(os.path.isdir(os.path.join(ROOT, name)), name)
        for name in ("app", "v2", "scripts"):
            self.assertFalse(os.path.exists(os.path.join(ROOT, name)), name)
        self.assertTrue(os.path.isfile(os.path.join(ROOT, "docs", "architecture.md")))

    def test_no_dependency_on_retired_trees(self) -> None:
        pattern = re.compile(r"(?<![\w/])(?:app|v2)/(?:server|web|tests|tools)|TASKA_OLD_SRC|taska-rewrite/")
        wrong: List[str] = []
        suffixes = (".py", ".ts", ".tsx", ".mjs", ".js", ".json", ".html", ".css", ".sh", ".plist", ".yml")
        for top in ("server", "web", "tools", ".github"):
            for folder, dirs, names in os.walk(os.path.join(ROOT, top)):
                dirs[:] = [d for d in dirs if d not in ("node_modules", "dist", "live", "dist-storybook", "__pycache__",
                                                        "test-results", "playwright-report")]
                for name in names:
                    if not name.endswith(suffixes) or name == "package-lock.json":
                        continue
                    path = os.path.join(folder, name)
                    for line, text in enumerate(read(path).splitlines(), 1):
                        if pattern.search(text):
                            wrong.append(f"{os.path.relpath(path, ROOT)}:{line}: {text.strip()[:100]}")
        self.assertEqual(wrong, [])


if __name__ == "__main__":
    unittest.main()
