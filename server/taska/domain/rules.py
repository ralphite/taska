"""Taska's judgements about a project, as pure functions of its state: what waits on the user, who spoke last, what
an agent should handle, how items are ordered, how references are read.

The page, the agent answers and the projects' counts all read these, so they agree.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable, Dict, Iterable, List, Optional, Set, Tuple

from . import events as ev
from .markdown import blocks as md_blocks, block_key
from .model import Comment, Doc, Input, Item, Message
from .state import ProjectState
from .vocab import CLOSED, DOC_KEY, PEOPLE, TYPE_OF, USER_KINDS, Refused

Held = Callable[[Input], bool]


def user_word(x: Message) -> bool:
    """A message that is the user's own words: what they wrote there, or what the organizer filed there from one of
    their inputs (often as a decision). Any of them answers an open question. The organizer's own notes are not."""
    return x.by == "you" or (x.by == "org" and x.kind in USER_KINDS and bool(x.src))


def waiting(state: ProjectState, it: Item) -> Optional[Message]:
    """The open question (ask) or block an agent posted that the user has not answered yet. Whatever the user says
    after it answers it, and so does a comment of theirs on one of the item's documents."""
    for x in reversed(it.thread):
        if user_word(x) or x.kind == "withdraw":
            return None
        if x.kind in ("ask", "block"):
            said = (c.t for d in state.docs.values() if d.n == it.n and not d.deleted for c in d.comments if c.by == "you")
            return None if any(t > x.t for t in said) else x
    return None


def replied(it: Item) -> bool:
    """The user wrote after an agent's last word on this item: an agent should pick it up."""
    user = False
    for x in reversed(it.thread):
        if user_word(x):
            user = True
        elif x.by != "org":  # the organizer's own notes are neither side's word
            return user
    return False


def talked(state: ProjectState, it: Item) -> bool:
    """For the page: replied, counting comments on the item's documents as words on the item, the user's or an
    agent's, in time with its messages. An agent making the item is its first word."""
    said: List[Tuple[str, int, bool]] = []  # (when, order, the user's)
    if it.by not in (None, "you") and it.t0:
        said.append((it.t0, -1, False))
    for i, x in enumerate(it.thread):
        if user_word(x) or x.by != "org":
            said.append((x.t, i, user_word(x)))
    for d in state.docs.values():
        if d.n == it.n and not d.deleted:
            for c in d.comments:
                if c.t and c.by != "org":
                    said.append((c.t, len(it.thread), c.by == "you"))
    user = False
    for _, _, mine in sorted(said, reverse=True):
        if mine:
            user = True
        else:
            return user
    return False


def needs_you(state: ProjectState, it: Item) -> bool:
    """On the user's list of what needs them: an agent asks or is blocked, or it waits for approval or acceptance
    and the user has not replied since."""
    return bool(waiting(state, it)) or (it.status in ("proposed", "review") and not talked(state, it))


def pending(state: ProjectState) -> List[Input]:
    """Inputs not handled yet."""
    return [i for i in state.inputs.values() if not i.acked and not i.deleted]


def for_agent(state: ProjectState, organizer_on: bool, held: Held) -> List[Input]:
    """Inputs a coding agent should handle (the organizer, when on, sees them first; an undone filing waits until
    the user asks again; an input waiting for its voice note's words waits)."""
    return [i for i in pending(state) if (not organizer_on or i.org) and not (i.org and i.org.undone) and not held(i)]


def by_number(inputs: Iterable[Input]) -> List[Input]:
    return sorted(inputs, key=lambda i: i.number)


def by_priority(items: Iterable[Item]) -> List[Item]:
    """Now before later, then P0 to P3, then oldest first."""
    return sorted(items, key=lambda i: (i.when != "now", i.pri, i.n))


def open_kids(state: ProjectState, it: Item) -> List[Item]:
    """Subitems not finished yet, at any depth: a parent is done when they are."""
    out: List[Item] = []
    todo = [it.n]
    while todo:
        n = todo.pop()
        for k in state.items.values():
            if k.parent == n and k.live:
                todo.append(k.n)
                if k.status not in CLOSED:
                    out.append(k)
    return out


def descendants(state: ProjectState, n: int) -> List[Item]:
    """Every subitem under an item, at any depth."""
    out: List[Item] = []
    todo = [n]
    while todo:
        m = todo.pop()
        for k in state.items.values():
            if k.parent == m and k.live:
                out.append(k)
                todo.append(k.n)
    return out


def rules_in_force(state: ProjectState) -> List[Item]:
    return [i for i in by_priority(state.live_items())
            if i.type == "rule" and i.status not in CLOSED + ("proposed",) and not i.archived]


def is_rule_in_force(it: Item) -> bool:
    return it.type == "rule" and it.status not in CLOSED + ("proposed",) and not it.archived and it.merged_into is None


# ----------------------------------------------------------------------------- references


@dataclass
class RefContext:
    """What a run of commands shares: `$` is the item the last `new` made."""

    src: Optional[str] = None
    keep: bool = False
    last: Optional[int] = None


_ITEM_REF = re.compile(r"([A-Za-z]?)0*(\d+)")


def item_at(state: ProjectState, ref: object, ctx: Optional[RefContext] = None, follow: bool = True) -> Item:
    """The item a reference names (B03, b3, 3, $); a merged item leads to the one it went into."""
    s = str(ref).strip()
    if s == "$":
        if not ctx or not ctx.last:
            raise Refused("$ is empty: no item created earlier in this request")
        s = str(ctx.last)
    m = _ITEM_REF.fullmatch(s)
    if not m or (m.group(1) and m.group(1).upper() not in TYPE_OF):
        raise Refused(f"bad item ref '{s}'")
    it = state.items.get(int(m.group(2)))
    if not it:
        raise Refused(f"{s} not found")
    while follow and it.merged_into:
        it = state.items[it.merged_into]
    return it


def doc_at(state: ProjectState, ref: object) -> Doc:
    m = re.fullmatch(r"[Dd]?(\d+)", str(ref).strip())
    d = state.docs.get(int(m.group(1))) if m else None
    if not d:
        raise Refused(f"no document {ref}")
    return d


# ----------------------------------------------------------------------------- documents


@dataclass
class DocBlock:
    """A paragraph (or a part of a web page commented on) with its comments."""

    key: str
    kind: str
    text: str
    comments: List[Comment] = field(default_factory=list)


@dataclass
class Detached:
    """Comments whose paragraph was rewritten or removed."""

    key: str
    quote: str
    comments: List[Comment] = field(default_factory=list)


def doc_view(d: Doc) -> Tuple[List[DocBlock], List[Detached]]:
    """The document's blocks with their comments; comments whose paragraph changed come back detached. A web page
    has no paragraphs: each part commented on is a block of its own."""
    out: List[DocBlock] = []
    keys: Set[str] = set()
    if d.is_page:
        for c in d.comments:
            if c.key == DOC_KEY:
                continue
            if c.key not in keys:
                keys.add(c.key)
                out.append(DocBlock(key=c.key, kind="html", text=c.quote))
            next(b for b in out if b.key == c.key).comments.append(c)
        return out, []
    for kind, text in md_blocks(d.md):
        key = block_key(text)
        first = key not in keys
        keys.add(key)
        out.append(DocBlock(key=key, kind=kind, text=text, comments=[c for c in d.comments if c.key == key] if first else []))
    detached: Dict[str, Detached] = {}
    for c in d.comments:
        if c.key not in keys and c.key != DOC_KEY:
            detached.setdefault(c.key, Detached(key=c.key, quote=c.quote)).comments.append(c)
    return out, list(detached.values())


def doc_whole(d: Doc) -> List[Comment]:
    """The comments on the document as a whole."""
    return [c for c in d.comments if c.key == DOC_KEY]


def doc_unanswered(d: Doc) -> int:
    """Threads whose last word is the user's and that are not resolved: an agent should answer them."""
    last: Dict[str, str] = {}
    for c in d.comments:
        last[f"{c.key}#{c.th}"] = c.by
    return sum(1 for k, by in last.items() if by == "you" and k not in d.resolved)


# ----------------------------------------------------------------------------- what a change is about


def touches(state: ProjectState, e: ev.Event) -> List[int]:
    """The items an event changes or adds to: a change, a message, a reply, a subitem, a document, a comment."""
    out = list(e.items_touched())
    if isinstance(e, (ev.CommentAdded, ev.CommentEdited, ev.CommentDeleted, ev.CommentRestored, ev.ThreadResolved,
                      ev.DocDeleted, ev.DocMoved, ev.CommentMoved)) and e.d in state.docs:
        out.append(state.docs[e.d].n)
    return out


def touched_since(state: ProjectState, n: int, seq: int) -> bool:
    return any(n in touches(state, e) for e in state.events[seq:])


def agent_hands(state: ProjectState) -> Set[int]:
    """Items an agent changed, wrote on, or added a subitem, document or comment to (making an item is not working
    on it)."""
    hands: Set[int] = set()
    for e in state.events:
        if e.by and e.by not in PEOPLE:
            made = e.n if isinstance(e, ev.ItemAdded) else None
            hands.update(m for m in touches(state, e) if m != made)
    return hands


def queue_order(items: List[Item]) -> List[Item]:
    """The order agents take the work: in progress first; then the user's own order comes before priority: what
    they dragged or put next keeps its place (rank), and what they never placed goes in by priority, each just before
    the first item of their order that has a lower priority."""
    out: List[Item] = []
    for doing in (True, False):
        mine = [i for i in items if (i.status == "doing") == doing]
        ranked = sorted((i for i in mine if i.rank is not None), key=lambda i: (i.rank, i.n))
        rest = sorted((i for i in mine if i.rank is None), key=lambda i: (i.pri, i.n))
        k = 0
        for r in ranked:
            while k < len(rest) and rest[k].pri < r.pri:
                out.append(rest[k])
                k += 1
            out.append(r)
        out += rest[k:]
    return out
