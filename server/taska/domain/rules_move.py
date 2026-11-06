"""Once per project (I693): the rule items become the rules document. Version 1 is the rules in force, in the order
GET /rules gave them (now before later, P0 to P3, oldest first), each a section "## <its title>" and its body with
the body's own headings one level down, the words unchanged; by taska, why "Rules moved into one document". A rule
waiting for the user (proposed, or in review) becomes a proposal on version 1, by whoever made it. Then every rule
item goes, with its talk and its documents (RulesMoved). Old texts that name rule codes stay as they are (r1128).
Pure: `plan` says the changes; the project makes them.
"""

from __future__ import annotations

import re
from typing import List

from . import events as ev
from .model import Item, SectionEdit
from .rules import by_priority
from .state import ProjectState
from .vocab import CLOSED

WHY = "Rules moved into one document"
_HEADING = re.compile(r"(#{1,5})(?=\s)")


def _rule(it: Item) -> bool:
    return it.type == "rule" and it.live and not it.archived


def in_force(st: ProjectState) -> List[Item]:
    """The rules in force as /rules listed them, a rule waiting for the user aside."""
    return [i for i in by_priority(st.items.values()) if _rule(i) and i.status not in CLOSED + ("proposed", "review")]


def waiting(st: ProjectState) -> List[Item]:
    return [i for i in by_priority(st.items.values()) if _rule(i) and i.status in ("proposed", "review")]


def body_of(body: str) -> str:
    """A rule's body under its section: its headings one level down, nothing else changed."""
    out: List[str] = []
    fence = False
    for line in body.strip("\n").split("\n"):
        if line.lstrip().startswith("```"):
            fence = not fence
        out.append(line if fence or not _HEADING.match(line) else "#" + line)
    return "\n".join(out)


def section(it: Item) -> str:
    title = " ".join(it.title.split())
    body = body_of(it.body)
    return f"## {title}\n\n{body}" if body.strip() else f"## {title}"


def plan(st: ProjectState, t: str) -> List[ev.Event]:
    """The changes, in order (none: nothing to move)."""
    rule_items = sorted(n for n, i in st.items.items() if i.type == "rule")
    if not rule_items:
        return []
    out: List[ev.Event] = []
    d = st.rules_d or st.max_doc + 1
    base = 0
    md = "\n\n".join(section(i) for i in in_force(st))
    if md:
        out.append(ev.DocWritten(d=d, n=0, kind="rules", title="Rules", md=md, why=WHY, by="taska", t=t))
        base = len(st.events) + 1
    for i in waiting(st):
        body = body_of(i.body)
        out.append(ev.DocProposed(d=d, base=base, why=" ".join(i.title.split()), by=i.by or "taska", t=t,
                                  edits=[SectionEdit(op="add", section=" ".join(i.title.split()), md=body)]))
    out.append(ev.RulesMoved(ns=rule_items, by="taska", t=t))
    return out
