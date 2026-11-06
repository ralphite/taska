"""A project's rules document by its sections (I693): a section is a heading and what follows it up to the next
heading of its level or higher. Agents and the organizer change the rules by naming sections (replace, add, delete),
so the server writes the new text exactly and a change can be checked and shown section by section. Pure.
"""

from __future__ import annotations

import difflib
import re
import textwrap
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from .model import SectionEdit
from .vocab import Refused

_HEADING = re.compile(r"(#{1,6})\s+(.*?)\s*#*\s*$")
EDIT_OPS = ("replace", "add", "delete", "whole")


@dataclass
class Section:
    title: str  # the heading's words
    level: int
    start: int  # its first line
    end: int  # the line after its last


def name_of(title: str) -> str:
    """A section's name as it is matched: its words, any case, any spacing, without the #s."""
    return " ".join(title.lstrip("#").split()).casefold()


def _lines(md: str) -> List[str]:
    return md.replace("\r\n", "\n").split("\n")


def sections(md: str) -> List[Section]:
    """Every heading's section, in order (code blocks have no headings)."""
    lines = _lines(md)
    heads: List[Tuple[int, int, str]] = []
    fence = False
    for i, line in enumerate(lines):
        if line.lstrip().startswith("```"):
            fence = not fence
            continue
        m = None if fence else _HEADING.match(line)
        if m:
            heads.append((i, len(m.group(1)), m.group(2)))
    out: List[Section] = []
    for k, (i, level, title) in enumerate(heads):
        end = next((j for j, lv, _ in heads[k + 1:] if lv <= level), len(lines))
        out.append(Section(title=title, level=level, start=i, end=end))
    return out


def find(md: str, title: str) -> Section:
    want = name_of(title)
    got = [s for s in sections(md) if name_of(s.title) == want]
    if not got:
        names = ", ".join(f'"{s.title}"' for s in sections(md) if s.level <= 2) or "none"
        raise Refused(f'the rules have no section "{title.lstrip("# ").strip()}" (sections: {names})')
    if len(got) > 1:
        raise Refused(f'the rules have {len(got)} sections called "{title}": change the whole text instead')
    return got[0]


def text_of(md: str, s: Section) -> str:
    return "\n".join(_lines(md)[s.start:s.end]).strip("\n")


def _join(*parts: str) -> str:
    return "\n\n".join(p.strip("\n") for p in parts if p.strip())


def apply(md: str, edits: List[SectionEdit]) -> str:
    """The text with each edit made, in order. A section named that is not there, or a whole text that is empty, is
    refused with the reason."""
    for e in edits:
        if e.op == "whole":
            if not e.md.strip():
                raise Refused("a whole new text needs its text")
            md = e.md.strip("\n")
            continue
        if e.op not in EDIT_OPS or not e.section.strip():
            raise Refused("each change names a section: replace, add or delete ## <its title>")
        lines = _lines(md)
        if e.op == "add":
            if any(name_of(s.title) == name_of(e.section) for s in sections(md)):
                raise Refused(f'the rules already have a section "{e.section}": replace it instead')
            new = e.md.strip("\n")
            if not _HEADING.match(new.split("\n", 1)[0]):
                new = _join(f"## {e.section.lstrip('# ').strip()}", new)
            if e.after:
                at = find(md, e.after)
                md = _join("\n".join(lines[:at.end]), new, "\n".join(lines[at.end:]))
            else:
                md = _join(md, new)
            continue
        s = find(md, e.section)
        before, after = "\n".join(lines[:s.start]), "\n".join(lines[s.end:])
        if e.op == "delete":
            md = _join(before, after)
            continue
        new = e.md.strip("\n")
        if not new:
            raise Refused(f'replace "{e.section}" needs its new text (delete it to take it out)')
        if not _HEADING.match(new.split("\n", 1)[0]):
            new = _join(lines[s.start], new)  # its heading stays
        md = _join(before, new, after)
    return md.strip("\n")


def touched(edits: List[SectionEdit]) -> Optional[List[str]]:
    """The sections a change is about (None: the whole text)."""
    if any(e.op == "whole" for e in edits):
        return None
    return [t for e in edits for t in (e.section, e.after) if t]


def changed_since(base: str, now: str, edits: List[SectionEdit]) -> List[str]:
    """The sections a change names that are not as they were when it was written (a whole new text: any change)."""
    names = touched(edits)
    if names is None:
        return ["the text"] if base.strip() != now.strip() else []

    def span(md: str, title: str) -> Optional[str]:
        got = [s for s in sections(md) if name_of(s.title) == name_of(title)]
        return text_of(md, got[0]) if len(got) == 1 else None
    return [t for t in dict.fromkeys(names) if span(base, t) != span(now, t)]


def _by_name(md: str) -> Dict[str, Tuple[str, str]]:
    """The top sections (the highest level there is) by name: (title, text)."""
    ss = sections(md)
    top = min((s.level for s in ss), default=2)
    return {name_of(s.title): (s.title, text_of(md, s)) for s in ss if s.level == top}


def diff(before: str, after: str) -> List[str]:
    """What changed, section by section, as lines: "changed: <title>" (or added, removed) then the lines that went
    ("- ") and came ("+ "). Text outside any section counts as one section of its own."""
    a, b = _by_name(before), _by_name(after)
    out: List[str] = []
    names = list(dict.fromkeys(list(b) + list(a)))
    pre_a, pre_b = _preamble(before), _preamble(after)
    if pre_a != pre_b:
        out += ["changed: the text before the first section"] + _lines_changed(pre_a, pre_b)
    for k in names:
        if k in a and k in b and a[k][1] == b[k][1]:
            continue
        word = "added" if k not in a else "removed" if k not in b else "changed"
        title = (b.get(k) or a[k])[0]
        out += [f"{word}: {title}"] + _lines_changed(a[k][1] if k in a else "", b[k][1] if k in b else "")
    return out


def _preamble(md: str) -> str:
    ss = sections(md)
    return "\n".join(_lines(md)[:ss[0].start]).strip() if ss else md.strip()


def _lines_changed(a: str, b: str) -> List[str]:
    out: List[str] = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, _lines(a), _lines(b), autojunk=False).get_opcodes():
        if tag == "equal":
            continue
        out += ["  - " + x for x in _lines(a)[i1:i2] if x.strip()] + ["  + " + x for x in _lines(b)[j1:j2] if x.strip()]
    return out


def counts(before: str, after: str) -> Tuple[int, int]:
    """Lines added and removed (blank lines aside)."""
    add = rem = 0
    a = [x for x in _lines(before) if x.strip()]
    b = [x for x in _lines(after) if x.strip()]
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag != "equal":
            rem += i2 - i1
            add += j2 - j1
    return add, rem


def read_edits(body: str) -> List[SectionEdit]:
    """The changes an agent or the organizer writes under `rules propose` / `rules edit`: lines that say what to do,
    each with its text indented under it:

        replace ## Commits
          - Commit messages are in English.
        add ## Tests after ## Commits
          - Run the unit tests before each commit.
        delete ## Old section
        whole
          <the whole new text, only when the whole text is meant>
    """
    out: List[SectionEdit] = []
    lines = body.replace("\r\n", "\n").split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        m = re.fullmatch(r"(?i)(replace|add|delete)\s+(.+?)(?:\s+after\s+(#+\s*.+))?\s*", line) if line[:1] not in " \t" else None
        whole = line[:1] not in " \t" and line.strip().lower() == "whole"
        if not m and not whole:
            raise Refused(f"cannot read '{line.strip()[:60]}': each change starts with replace, add or delete "
                          "## <section>, or whole, its text indented under it")
        j = i + 1
        while j < len(lines) and (not lines[j].strip() or lines[j][:1] in " \t"):
            j += 1
        text = textwrap.dedent("\n".join(lines[i + 1:j])).strip("\n")
        if whole:
            out.append(SectionEdit(op="whole", md=text))
        else:
            assert m is not None
            out.append(SectionEdit(op=m.group(1).lower(), section=m.group(2).lstrip("#").strip(), md=text,
                                   after=(m.group(3) or "").lstrip("#").strip()))
        i = j
    if not out:
        raise Refused("say what changes: replace, add or delete ## <section> (its text indented under it), or whole")
    return out
