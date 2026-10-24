"""Installing the Taska skill for every coding agent found on this machine (python3 -m taska install-skill)."""

from __future__ import annotations

import os

from .guide_text import SKILL

SKILL_DIRS = {"Claude Code": "~/.claude/skills", "Codex": "~/.codex/skills", "Antigravity": "~/.gemini/config/skills"}


def install_skill() -> None:
    """Write SKILL.md for every coding agent found on this machine (user level, all projects)."""
    for agent, d in SKILL_DIRS.items():
        root = os.path.expanduser(d)
        if not os.path.isdir(os.path.dirname(root)):
            print(f"  skip {agent}: {os.path.dirname(root)} not found")
            continue
        os.makedirs(os.path.join(root, "taska"), exist_ok=True)
        path = os.path.join(root, "taska", "SKILL.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(SKILL)
        print(f"  {agent}: {path}")
