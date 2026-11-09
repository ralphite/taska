"""Prepare a GitHub release: the archive, its checksum and the notes, then print the command that publishes them.

    python3 tools/release.py                 version from web/package.json (v3.0.0)
    python3 tools/release.py --version 3.0.1 --skip-web

It builds dist/taska.pyz (tools/build_pyz.py), starts it once (tools/check_package.py), writes
dist/taska.pyz.sha256 (what install.sh checks the download against) and dist/release-notes.md (the commits since the
last tag). It publishes nothing: run the printed `gh release create` yourself, after pushing the commit it names.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from typing import List

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
REPO = "ralphite/taska"
INSTALL = f"curl -fsSL https://github.com/{REPO}/releases/latest/download/install.sh | sh"
MAX_CHANGES = 40


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()


def last_tag() -> str:
    try:
        return git("describe", "--tags", "--abbrev=0", "--match", "v*")
    except subprocess.CalledProcessError:
        return ""


def notes(tag: str, since: str) -> str:
    lines = [f"Taska {tag}", "", "Install or update on Linux, as your own user (no root), with Python 3.9+:", "",
             "```sh", INSTALL, "```", "",
             "Or download `taska.pyz` and run `python3 taska.pyz`; it needs nothing but Python.", ""]
    if since:
        subjects: List[str] = git("log", "--no-merges", "--format=%s", f"{since}..HEAD").splitlines()
        lines += [f"## Changes since {since}", ""]
        lines += [f"- {s}" for s in subjects[:MAX_CHANGES]]
        if len(subjects) > MAX_CHANGES:
            lines.append(f"- and {len(subjects) - MAX_CHANGES} more: "
                         f"https://github.com/{REPO}/compare/{since}...{tag}")
    else:
        lines += ["The first release."]
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--version", help="X.Y.Z (default: web/package.json)")
    ap.add_argument("--skip-web", action="store_true", help="package the page already built in web/dist")
    a = ap.parse_args()
    with open(os.path.join(ROOT, "web", "package.json"), encoding="utf-8") as f:
        version = (a.version or json.load(f)["version"]).lstrip("v")
    tag = "v" + version
    if git("tag", "--list", tag):
        print(f"{tag} is already tagged: pass --version", file=sys.stderr)
        return 1
    if git("status", "--porcelain", "--untracked-files=no"):
        print("note: the checkout has uncommitted changes; the archive includes them", file=sys.stderr)

    pyz = os.path.join(DIST, "taska.pyz")
    build = [sys.executable, os.path.join(ROOT, "tools", "build_pyz.py"), "--out", pyz]
    subprocess.run(build + (["--skip-web"] if a.skip_web else []), cwd=ROOT, check=True)
    subprocess.run([sys.executable, os.path.join(ROOT, "tools", "check_package.py"), pyz], cwd=ROOT, check=True)
    with open(pyz, "rb") as f:
        digest = hashlib.sha256(f.read()).hexdigest()
    with open(pyz + ".sha256", "w", encoding="utf-8") as f:
        f.write(f"{digest}  taska.pyz\n")
    notes_file = os.path.join(DIST, "release-notes.md")
    with open(notes_file, "w", encoding="utf-8") as f:
        f.write(notes(tag, last_tag()))

    commit = git("rev-parse", "HEAD")
    pyz_rel, notes_rel = os.path.relpath(pyz, ROOT), os.path.relpath(notes_file, ROOT)
    print(f"\nsha256 {digest}  taska.pyz\nnotes  {notes_rel}\n")
    print(f"Push {commit[:12]} to GitHub first, then from {ROOT}:\n")
    print(f"gh release create {tag} {pyz_rel} {pyz_rel}.sha256 install.sh --repo {REPO} --target {commit} "
          f"--title 'Taska {tag}' --notes-file {notes_rel}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
