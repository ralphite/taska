"""Skills (T821, Yadong r1402, r1406): named instructions the user applies to what they say, by starting it with the
skill's name (`/qa what does D12 say about exports?`; by voice "斜杠 QA ..." or "slash QA ..."). A skill is a shared
document whose name starts with "/" (services.shared_rules: kept once for every project, with versions, comments and
the editor), its first line what it is for. Agents see the list with the rules and may apply one when it fits; words
that start with a skill's name come to every agent (the organizer, Taska's own, the coding agents) with the skill's
text under them, so nothing is installed anywhere and a change applies at once.

Pure: no I/O."""

from __future__ import annotations

import re
from typing import Dict, List, Mapping, Optional, Tuple

from .includes import norm

MARK = "/"
# how the start of a voice note is heard when the user says a skill's name ("斜杠 QA", "slash QA", "/ QA")
_SPOKEN = re.compile(r"^\s*(?:斜杠|斜线|slash|/)\s*([A-Za-z][\w-]*)", re.I)


def is_skill(name: str) -> bool:
    return name.strip().startswith(MARK) and len(name.strip()) > 1


def skills_of(shared: Mapping[str, str]) -> Dict[str, str]:
    """The skills among the shared documents: name -> text."""
    return {n: t for n, t in shared.items() if is_skill(n)}


def summary(text: str) -> str:
    """What a skill is for: its first line of words (a heading's words too)."""
    for line in text.splitlines():
        line = line.strip().lstrip("#").strip()
        if line:
            return line[:200]
    return ""


def catalog(skills: Mapping[str, str]) -> List[Tuple[str, str]]:
    """(name, what it is for) of each skill, by name."""
    return sorted(((n, summary(t)) for n, t in skills.items()), key=lambda x: norm(x[0]))


def invoked(words: str, skills: Mapping[str, str]) -> Optional[str]:
    """The skill these words start with (typed `/qa ...` or said "斜杠 QA ..."), by its name, or None."""
    m = _SPOKEN.match(words or "")
    if not m:
        return None
    said = norm(MARK + m.group(1))
    return next((n for n in skills if norm(n) == said), None)


def applied(words: str, skills: Mapping[str, str]) -> List[str]:
    """The lines an agent reads under words that apply a skill: its name and its text."""
    name = invoked(words, skills)
    if not name:
        return []
    body = skills[name].strip() or "(no text yet)"
    return [f"skill {name} (the user applied it to these words; do as it says):"] + ["  " + ln for ln in body.splitlines()]


def listing(skills: Mapping[str, str], base: str) -> str:
    """The skills as agents see them with the rules."""
    rows = catalog(skills)
    if not rows:
        return ""
    lines = ["Skills (the user starts words with a skill's name to apply it, and its text comes with those words; "
             f"apply one yourself when it fits what you are asked: its text is GET {base}/skill?name=<name>):"]
    lines += [f"  {n}  {what}" for n, what in rows]
    return "\n".join(lines)
