"""Shared rules put into a project's rules by a line of their text (I779, D134). A project's rules document is a
template: a line of its own `{{编程}}` puts the shared rules called 编程 there, `{{编程 › 测试}}` only its section 测试.
What is kept is the line; whoever reads the rules (an agent, the organizer) gets the text in its place, each part
saying which shared rules it came from, and first that the project's own words win. Shared rules are one level: a
shared rule puts no other in itself. Pure.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Mapping, Optional, Tuple

from .sections import sections, text_of
from .vocab import Refused

# a line of its own: {{name}} or {{name › section}} ("›" or ">")
LINE = re.compile(r"\{\{\s*([^{}›>\n]+?)\s*(?:[›>]\s*([^{}\n]+?)\s*)?\}\}")
NAME_MAX = 60
WIN = ("Parts of these rules come from shared rules, which several projects use: each line `{{name}}` of this "
       "project's rules is read as the shared rules it names. Where this project's own words and a shared part "
       "disagree, this project's own words win. A proposal changes this project's own text (a line `{{name}}` is one "
       "line of it); the user changes the shared rules themselves.")


@dataclass(frozen=True)
class Include:
    name: str
    part: Optional[str]  # a section of it; None: the whole of it
    line: str  # the line as written

    @property
    def label(self) -> str:
        return f"{self.name} › {self.part}" if self.part else self.name


def norm(s: str) -> str:
    """A name as it is matched: its words, any case, any spacing."""
    return " ".join(s.split()).casefold()


def include_of(line: str) -> Optional[Include]:
    m = LINE.fullmatch(line.strip())
    return Include(name=" ".join(m.group(1).split()), part=" ".join(m.group(2).split()) if m.group(2) else None,
                   line=line.strip()) if m else None


def _lines(md: str) -> List[Tuple[str, Optional[Include]]]:
    """Each line, with the include it is (none in a code block)."""
    out: List[Tuple[str, Optional[Include]]] = []
    fence = False
    for line in md.replace("\r\n", "\n").split("\n"):
        if line.lstrip().startswith("```"):
            fence = not fence
            out.append((line, None))
            continue
        out.append((line, None if fence else include_of(line)))
    return out


def includes(md: str) -> List[Include]:
    """The lines that put shared rules in, in order."""
    return [i for _, i in _lines(md) if i]


@dataclass(frozen=True)
class Part:
    """A section of a shared rule that a line can name: `name` is its heading's words before a "（…）" or "(…)"."""

    name: str
    title: str
    md: str


def parts(md: str) -> List[Part]:
    """The sections a line can name: those of its top level (## when it has any)."""
    ss = sections(md)
    if not ss:
        return []
    level = 2 if any(s.level == 2 for s in ss) else min(s.level for s in ss)
    return [Part(name=re.split(r"[（(]", s.title, maxsplit=1)[0].strip() or s.title, title=s.title, md=text_of(md, s))
            for s in ss if s.level == level]


def _shared(name: str, shared: Mapping[str, str]) -> Optional[Tuple[str, str]]:
    want = norm(name)
    return next(((n, md) for n, md in shared.items() if norm(n) == want), None)


def text_of_include(inc: Include, shared: Mapping[str, str]) -> Optional[str]:
    """What a line puts in its place; None: no shared rules by that name, or no such section in them."""
    got = _shared(inc.name, shared)
    if got is None:
        return None
    if not inc.part:
        return got[1].strip("\n")
    want = norm(inc.part)
    return next((p.md for p in parts(got[1]) if want in (norm(p.name), norm(p.title))), None)


def _marked(text: str, name: str) -> str:
    """Each heading of the text says where it came from; text that starts without one gets a line that says so."""
    mark = f" (from shared rules “{name}”)"
    out: List[str] = []
    fence = False
    for line in text.split("\n"):
        if line.lstrip().startswith("```"):
            fence = not fence
        out.append(line.rstrip() + mark if not fence and re.match(r"#{1,6}\s", line) else line)
    if not re.match(r"#{1,6}\s", text.lstrip()):
        out.insert(0, f"(From shared rules “{name}”:)")
    return "\n".join(out)


def expand(md: str, shared: Mapping[str, str]) -> str:
    """The rules as they are read: each line replaced by the text it puts in (a name not found said in its place).
    Text with no such line is given back exactly as it is."""
    rows = _lines(md)
    if not any(i for _, i in rows):
        return md
    out: List[str] = []
    for line, inc in rows:
        if not inc:
            out.append(line)
            continue
        got = text_of_include(inc, shared)
        if got is None:
            what = f"no section “{inc.part}” in shared rules “{inc.name}”" if inc.part and _shared(inc.name, shared) \
                else f"no shared rules called “{inc.name}”"
            out.append(f"(Not found: {inc.line} names {what}; tell the user.)")
        else:
            name = _shared(inc.name, shared)[0]  # type: ignore[index]
            out.append(_marked(got, f"{name} › {inc.part}" if inc.part else name))
    return "\n".join(out)


def win_line(md: str) -> str:
    """Said first when the rules put shared rules in: the project's own words win."""
    return WIN if includes(md) else ""


def used_by(projects: Mapping[str, Tuple[str, str]], names: List[str]) -> Dict[str, List[Tuple[str, str, str]]]:
    """For each shared rule (by its name as kept), the projects whose rules put it in: (slug, title, the line), in the
    order given. `projects`: slug -> (title, its rules' text)."""
    out: Dict[str, List[Tuple[str, str, str]]] = {n: [] for n in names}
    by_norm = {norm(n): n for n in names}
    for slug, (title, md) in projects.items():
        for inc in includes(md):
            n = by_norm.get(norm(inc.name))
            if n is not None:
                out[n].append((slug, title, inc.line))
    return out


def check_name(name: object, taken: List[str]) -> str:
    """A new shared rule's name: one line, no braces or ›, not one already there (any case)."""
    n = " ".join(str(name or "").split())
    if not n:
        raise Refused("give the shared rules a name")
    if len(n) > NAME_MAX:
        raise Refused(f"a name of at most {NAME_MAX} characters")
    if any(c in n for c in "{}›>"):
        raise Refused("a name without { } › or >")
    if norm(n) in {norm(t) for t in taken}:
        raise Refused(f"shared rules called {n} exist already")
    return n


def check_shared_text(md: str) -> None:
    """A shared rule puts no other in itself (one level, D134)."""
    if includes(md):
        raise Refused("shared rules put no other shared rules in: take out " + ", ".join(i.line for i in includes(md)))
