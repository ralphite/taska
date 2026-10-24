"""Small text helpers shared by the rules and the answers: one-line summaries, times, titles, edits, names."""

from __future__ import annotations

import re
import unicodedata
from datetime import datetime

from .vocab import TITLE_MAX, Refused


def first_line(text: object, limit: int = 60) -> str:
    """The text on one line, cut to `limit` characters with an ellipsis."""
    s = " ".join(str(text).split())
    return s if len(s) <= limit else s[: limit - 1] + "…"


def hm(t: str) -> str:
    """An ISO time as "MM-DD HH:MM"."""
    return t[5:10] + " " + t[11:16]


def seconds(t: str) -> float:
    """An ISO time as seconds since the epoch."""
    return datetime.fromisoformat(t).timestamp()


def plain_key(k: object) -> str:
    """A key as typed, reduced to what counts: lower-case letters and digits."""
    return re.sub(r"[^a-z0-9]", "", str(k or "").lower())


def squash(text: object) -> str:
    """Whitespace runs as single spaces, trimmed."""
    return " ".join(str(text).split())


_TITLE_REF = re.compile(r"(?i)\[src=(r\d+)\]|\[parent=[A-Za-z]?\d+\]|\bsrc=(r\d+)\b")
_TITLE_LEAD = re.compile(
    r"(?i)(?:\s*\[(?:P[0-3]|now|later|open|doing|review|done|drop|dropped|feature|bug|idea|task|rule)\])+")


def clean_title(title: str) -> tuple[str, str | None]:
    """A title with the guide's options left in it ("[src=r246] Fix the export", B222) -> (the title without them,
    the input it named or None). Bare words stay: "Open the settings" keeps its Open."""
    if "src=" not in title and "parent=" not in title and "[" not in title:
        return title, None
    named: list[str] = []

    def drop(m: re.Match[str]) -> str:
        if m[1] or m[2]:
            named.append((m[1] or m[2]).lower())
        return " "

    out = _TITLE_REF.sub(drop, title)
    lead = _TITLE_LEAD.match(out)
    if lead:
        out = out[lead.end():]
    out = squash(out)
    if not out:
        return title, None
    return out, (named[0] if named else None)


def edit_note(rid: str, old: str, new: str) -> str:
    """What changed in an input, short: the words added, or the part that changed ("old" -> "new")."""
    if new.startswith(old) and old.strip():
        return f"Added to {rid}:\n{new[len(old):].strip()}"
    i = 0
    while i < min(len(old), len(new)) and old[i] == new[i]:
        i += 1
    j = 0
    while j < min(len(old), len(new)) - i and old[-1 - j] == new[-1 - j]:
        j += 1

    def wordy(c: str) -> bool:
        return c.isascii() and c.isalnum()

    while i > 0 and wordy(old[i - 1]):  # whole words, where words have spaces
        i -= 1
    while j > 0 and wordy(old[len(old) - j]):
        j -= 1
    was, became = old[i:len(old) - j].strip(), new[i:len(new) - j].strip()
    if not old.strip() or len(was) + len(became) > 400:
        return f"Edited {rid}:\n{new}"
    return f"Edited {rid}: “{was}” → “{became}”"


def project_title(name: object) -> str:
    """A project's name for people: any text on one line, up to TITLE_MAX characters."""
    t = squash(name or "")
    if not t:
        raise Refused("give the project a name")
    if len(t) > TITLE_MAX:
        raise Refused(f"a project name is up to {TITLE_MAX} characters")
    return t


def slug_of(title: str) -> str:
    """The address a new project gets from its name: Home Budget -> home-budget; "" when the name has no a-z or 0-9."""
    t = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:40].strip("-")
