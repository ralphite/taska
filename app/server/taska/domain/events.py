"""Every kind of change, as a typed event, and its stored JSON row (the `events` table, one row per change).

The rows are the stored format: their keys and the order of the keys are kept exactly, so the older version runs on
a log this one wrote (a roll back). `decode` reads any row, `Event.to_row` writes one; nothing else touches the JSON.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, ClassVar, Dict, List, Optional, Type

from .model import FileRef, Row, files_row
from .text import clean_title


@dataclass
class Event:
    """What every change has: who made it, when, from which agent session, and its number in the log."""

    by: str = ""
    t: str = ""
    ses: Optional[str] = None
    seq: int = 0  # its place in the log, from 1; set when it is applied
    src: Optional[str] = None  # the input it came from, for the kinds that keep one

    KIND: ClassVar[str] = ""

    def body(self) -> Row:
        """The stored keys between "k" and "t", in their stored order."""
        raise NotImplementedError

    def to_row(self) -> Row:
        row: Row = {"k": self.KIND, **self.body(), "t": self.t}
        if self.ses:
            row["ses"] = self.ses
        return row

    def items_touched(self) -> List[int]:
        """The items this change is about directly (documents are added by the rules, which know their items)."""
        return []


def _opt(row: Row, key: str, value: Any, when: bool) -> None:
    if when:
        row[key] = value


@dataclass
class InputAdded(Event):
    """You said something: a new input, or a reply on an item (scope)."""

    KIND: ClassVar[str] = "in"
    id: str = ""
    text: str = ""
    scope: Optional[int] = None
    files: List[FileRef] = field(default_factory=list)
    q: str = ""  # the page's id for it, so one sent again goes in once
    kind: Optional[str] = None  # "answer": a form you sent on its item

    def body(self) -> Row:
        row: Row = {"id": self.id, "by": self.by, "text": self.text, "scope": self.scope, "files": files_row(self.files)}
        _opt(row, "q", self.q, bool(self.q))
        _opt(row, "kind", self.kind, bool(self.kind))
        return row

    def items_touched(self) -> List[int]:
        return [self.scope] if self.scope else []


@dataclass
class ItemAdded(Event):
    KIND: ClassVar[str] = "add"
    n: int = 0
    title: str = ""  # as written; `clean` is what the item gets
    type: str = "idea"
    pri: str = "P2"
    when: str = "now"
    status: str = "open"
    body_text: str = ""
    next: str = ""
    parent: Optional[int] = None
    keep: bool = False  # linked to src, but src stays unhandled

    def body(self) -> Row:
        row: Row = {"n": self.n, "by": self.by, "title": self.title, "src": self.src, "type": self.type,
                    "pri": self.pri, "when": self.when, "status": self.status, "body": self.body_text,
                    "next": self.next, "parent": self.parent}
        _opt(row, "keep", True, self.keep)
        return row

    @property
    def clean(self) -> str:
        return clean_title(self.title)[0]

    def items_touched(self) -> List[int]:
        return [x for x in (self.n, self.parent) if x]


@dataclass
class FieldsSet(Event):
    """Fields of an item changed; `was` holds what they were."""

    KIND: ClassVar[str] = "set"
    n: int = 0
    f: Dict[str, Any] = field(default_factory=dict)
    was: Dict[str, Any] = field(default_factory=dict)
    keep: bool = False
    undo_of: Optional[int] = None  # the change of yours this puts back
    cascade: Optional[int] = None  # the item this followed (a change to a parent goes to its subitems)

    def body(self) -> Row:
        row: Row = {"n": self.n, "by": self.by, "f": dict(self.f), "was": dict(self.was), "src": self.src}
        _opt(row, "cascade", self.cascade, self.cascade is not None)
        _opt(row, "keep", True, self.keep)
        _opt(row, "undo_of", self.undo_of, bool(self.undo_of))
        return row

    @property
    def fields(self) -> Dict[str, Any]:
        """The new values as the item holds them (a title without the guide's options in it)."""
        if "title" in self.f:
            return dict(self.f, title=clean_title(str(self.f["title"]))[0])
        return self.f

    def items_touched(self) -> List[int]:
        out = [self.n] if self.n else []
        if self.f.get("parent"):
            out.append(self.f["parent"])
        return out


@dataclass
class MessagePosted(Event):
    KIND: ClassVar[str] = "say"
    n: int = 0
    kind: str = "say"
    text: str = ""
    files: List[FileRef] = field(default_factory=list)
    to: List[str] = field(default_factory=list)
    keep: bool = False

    def body(self) -> Row:
        row: Row = {"n": self.n, "by": self.by, "kind": self.kind, "text": self.text, "src": self.src}
        _opt(row, "files", files_row(self.files), bool(self.files))
        _opt(row, "to", list(self.to), bool(self.to))
        _opt(row, "keep", True, self.keep)
        return row

    def items_touched(self) -> List[int]:
        return [self.n] if self.n else []


@dataclass
class ItemMerged(Event):
    KIND: ClassVar[str] = "merge"
    n: int = 0
    into: int = 0
    keep: bool = False

    def body(self) -> Row:
        row: Row = {"n": self.n, "into": self.into, "by": self.by, "src": self.src}
        _opt(row, "keep", True, self.keep)
        return row

    def items_touched(self) -> List[int]:
        return [x for x in (self.n, self.into) if x]


@dataclass
class InputsAcked(Event):
    KIND: ClassVar[str] = "ack"
    ids: List[str] = field(default_factory=list)

    def body(self) -> Row:
        return {"ids": list(self.ids), "by": self.by}


@dataclass
class InputAmended(Event):
    """You edited an input, or added to it (mode)."""

    KIND: ClassVar[str] = "amend"
    mode: str = "edit"
    text: str = ""
    files: List[FileRef] = field(default_factory=list)

    def body(self) -> Row:
        row: Row = {"src": self.src, "mode": self.mode, "text": self.text, "by": self.by}
        _opt(row, "files", files_row(self.files), bool(self.files))
        return row


@dataclass
class WordsIn(Event):
    """A voice note's words, in after its input was sent; `was`: the shorter words they replace."""

    KIND: ClassVar[str] = "tr"
    f: str = ""
    tr: str = ""
    was: Optional[str] = None
    late: bool = False  # an agent or the organizer had the input without them

    def body(self) -> Row:
        row: Row = {"src": self.src, "f": self.f, "tr": self.tr}
        _opt(row, "was", self.was, self.was is not None)
        row["by"] = self.by
        _opt(row, "late", True, self.late)
        return row


@dataclass
class FilingUndone(Event):
    """The organizer's changes for an input taken back."""

    KIND: ClassVar[str] = "undo"

    def body(self) -> Row:
        return {"src": self.src, "by": self.by}


@dataclass
class FilingRedone(Event):
    KIND: ClassVar[str] = "redo"

    def body(self) -> Row:
        return {"src": self.src, "by": self.by}


@dataclass
class ItemsArchived(Event):
    """Many items archived or brought back in one change; `follow`: subitem -> the item it went along with."""

    KIND: ClassVar[str] = "arch"
    ns: List[int] = field(default_factory=list)
    on: bool = True
    follow: Dict[str, int] = field(default_factory=dict)

    def body(self) -> Row:
        row: Row = {"ns": list(self.ns), "on": self.on, "by": self.by}
        _opt(row, "follow", dict(self.follow), bool(self.follow))
        return row

    def items_touched(self) -> List[int]:
        return list(self.ns)


@dataclass
class InputDeleted(Event):
    """An input to Deleted, with the items only it made (ns); `kept`: [n, why] for those that stay."""

    KIND: ClassVar[str] = "del"
    ns: List[int] = field(default_factory=list)
    kept: List[List[Any]] = field(default_factory=list)

    def body(self) -> Row:
        return {"src": self.src, "ns": list(self.ns), "kept": [list(k) for k in self.kept], "by": self.by}

    def items_touched(self) -> List[int]:
        return list(self.ns)


@dataclass
class InputRestored(Event):
    KIND: ClassVar[str] = "undel"
    ns: List[int] = field(default_factory=list)

    def body(self) -> Row:
        return {"src": self.src, "ns": list(self.ns), "by": self.by}

    def items_touched(self) -> List[int]:
        return list(self.ns)


@dataclass
class InputMoved(Event):
    """An input sent to the wrong project lives on in another one."""

    KIND: ClassVar[str] = "moved"
    to: str = ""
    as_: str = ""

    def body(self) -> Row:
        return {"src": self.src, "to": self.to, "as": self.as_, "by": self.by}


@dataclass
class Organized(Event):
    """The organizer worked on an input (or is asked to again: retry)."""

    KIND: ClassVar[str] = "org"
    ok: bool = False
    msg: str = ""
    plan: Optional[str] = None
    keep: Optional[bool] = None
    changed: Optional[bool] = None
    ms: Optional[int] = None
    retry: bool = False

    def body(self) -> Row:
        if self.retry:
            return {"src": self.src, "retry": True, "by": self.by}
        row: Row = {"src": self.src, "ok": self.ok, "msg": self.msg}
        _opt(row, "plan", self.plan, self.plan is not None)
        _opt(row, "keep", self.keep, self.keep is not None)
        _opt(row, "changed", self.changed, self.changed is not None)
        _opt(row, "ms", self.ms, self.ms is not None)
        row["by"] = self.by
        return row


@dataclass
class ProjectRenamed(Event):
    KIND: ClassVar[str] = "cfg"
    name: Optional[str] = None

    def body(self) -> Row:
        return {"f": {"name": self.name} if self.name is not None else {}, "by": self.by}


@dataclass
class DocWritten(Event):
    """A document made, or its text replaced."""

    KIND: ClassVar[str] = "doc"
    d: int = 0
    n: int = 0
    title: str = ""
    md: str = ""
    fmt: Optional[str] = None

    def body(self) -> Row:
        row: Row = {"d": self.d, "n": self.n, "title": self.title, "md": self.md, "by": self.by}
        _opt(row, "fmt", self.fmt, bool(self.fmt))
        return row

    def items_touched(self) -> List[int]:
        return [self.n] if self.n else []


@dataclass
class ItemsDeleted(Event):
    """An item deleted by itself, with its subitems."""

    KIND: ClassVar[str] = "idel"
    ns: List[int] = field(default_factory=list)

    def body(self) -> Row:
        return {"ns": list(self.ns), "by": self.by}

    def items_touched(self) -> List[int]:
        return list(self.ns)


@dataclass
class ItemsRestored(Event):
    KIND: ClassVar[str] = "iundel"
    ns: List[int] = field(default_factory=list)

    def body(self) -> Row:
        return {"ns": list(self.ns), "by": self.by}

    def items_touched(self) -> List[int]:
        return list(self.ns)


@dataclass
class DocDeleted(Event):
    KIND: ClassVar[str] = "ddel"
    d: int = 0
    on: bool = True  # False: restored

    def body(self) -> Row:
        return {"d": self.d, "on": self.on, "by": self.by}


@dataclass
class DocMoved(Event):
    KIND: ClassVar[str] = "dmove"
    d: int = 0
    to: int = 0

    def body(self) -> Row:
        return {"d": self.d, "to": self.to, "by": self.by}


@dataclass
class CommentMoved(Event):
    KIND: ClassVar[str] = "dcmove"
    d: int = 0
    id: int = 0
    key: str = ""
    quote: str = ""

    def body(self) -> Row:
        return {"d": self.d, "id": self.id, "key": self.key, "quote": self.quote, "by": self.by}


@dataclass
class FileTakenOff(Event):
    """A file taken off an input (src) or off a comment (d, id)."""

    KIND: ClassVar[str] = "unfile"
    d: Optional[int] = None
    id: Optional[int] = None
    f: str = ""

    def body(self) -> Row:
        if self.d:
            return {"d": self.d, "id": self.id, "f": self.f, "by": self.by}
        return {"src": self.src, "f": self.f, "by": self.by}


@dataclass
class MessageHidden(Event):
    KIND: ClassVar[str] = "hide"
    n: int = 0
    id: int = 0
    on: bool = True

    def body(self) -> Row:
        return {"n": self.n, "id": self.id, "on": self.on, "by": self.by}

    def items_touched(self) -> List[int]:
        return [self.n] if self.n else []


@dataclass
class InputRescoped(Event):
    """What you said goes with another item."""

    KIND: ClassVar[str] = "rescope"
    to: int = 0

    def body(self) -> Row:
        return {"src": self.src, "to": self.to, "by": self.by}


@dataclass
class ThreadResolved(Event):
    """A comment thread resolved (on) or open again; th: one thread of the paragraph, else all of them."""

    KIND: ClassVar[str] = "dcres"
    d: int = 0
    key: str = ""
    on: bool = True
    th: Optional[int] = None

    def body(self) -> Row:
        row: Row = {"d": self.d, "key": self.key, "on": self.on, "by": self.by}
        _opt(row, "th", self.th, bool(self.th))
        return row


@dataclass
class CommentAdded(Event):
    KIND: ClassVar[str] = "dc"
    d: int = 0
    key: str = ""
    quote: str = ""
    text: str = ""
    files: List[FileRef] = field(default_factory=list)
    th: Optional[int] = None  # the thread a reply goes in

    def body(self) -> Row:
        row: Row = {"d": self.d, "key": self.key, "quote": self.quote, "text": self.text, "by": self.by}
        _opt(row, "files", files_row(self.files), bool(self.files))
        _opt(row, "th", self.th, bool(self.th))
        return row


@dataclass
class CommentEdited(Event):
    KIND: ClassVar[str] = "dcedit"
    d: int = 0
    id: int = 0
    text: str = ""
    files: List[FileRef] = field(default_factory=list)

    def body(self) -> Row:
        row: Row = {"d": self.d, "id": self.id, "text": self.text, "by": self.by}
        _opt(row, "files", files_row(self.files), bool(self.files))
        return row


@dataclass
class CommentDeleted(Event):
    KIND: ClassVar[str] = "dcdel"
    d: int = 0
    id: int = 0

    def body(self) -> Row:
        return {"d": self.d, "id": self.id, "by": self.by}


@dataclass
class CommentRestored(Event):
    KIND: ClassVar[str] = "dcundel"
    d: int = 0
    id: int = 0

    def body(self) -> Row:
        return {"d": self.d, "id": self.id, "by": self.by}


@dataclass
class Unknown(Event):
    """A kind this version does not apply (an old one, like "plain"): kept in the log as it is."""

    kind: str = ""
    raw: Row = field(default_factory=dict)

    def body(self) -> Row:
        return {k: v for k, v in self.raw.items() if k not in ("k", "t", "ses")}

    def to_row(self) -> Row:
        return dict(self.raw)


DOC_EVENTS = ("dc", "dcedit", "dcdel", "dcundel", "dcres", "ddel", "dmove", "dcmove")


# ----------------------------------------------------------------------------- reading rows


class Unreadable(Exception):
    """A stored row this version cannot read."""


def _files(row: Row) -> List[FileRef]:
    return [FileRef.from_row(f) for f in row.get("files") or []]


def _need(row: Row, key: str) -> Any:
    if key not in row:
        raise Unreadable(f"{row.get('k')} without {key}")
    return row[key]


def _common(row: Row) -> Dict[str, Any]:
    return {"by": row.get("by") or "", "t": row.get("t") or "", "ses": row.get("ses") or None}


Reader = Callable[[Row], Event]
READERS: Dict[str, Reader] = {
    "in": lambda r: InputAdded(id=_need(r, "id"), text=r.get("text", ""), scope=r.get("scope"), files=_files(r),
                               q=r.get("q") or "", kind=r.get("kind"), **_common(r)),
    "add": lambda r: ItemAdded(n=_need(r, "n"), title=_need(r, "title"), src=r.get("src"), type=_need(r, "type"),
                               pri=_need(r, "pri"), when=_need(r, "when"), status=_need(r, "status"),
                               body_text=r.get("body", ""), next=r.get("next", ""), parent=r.get("parent"),
                               keep=bool(r.get("keep")), **_common(r)),
    "set": lambda r: FieldsSet(n=_need(r, "n"), f=dict(_need(r, "f")), was=dict(r.get("was") or {}), src=r.get("src"),
                               keep=bool(r.get("keep")), undo_of=r.get("undo_of"), cascade=r.get("cascade"),
                               **_common(r)),
    "say": lambda r: MessagePosted(n=_need(r, "n"), kind=_need(r, "kind"), text=_need(r, "text"), src=r.get("src"),
                                   files=_files(r), to=list(r.get("to") or []), keep=bool(r.get("keep")), **_common(r)),
    "merge": lambda r: ItemMerged(n=_need(r, "n"), into=_need(r, "into"), src=r.get("src"), keep=bool(r.get("keep")),
                                  **_common(r)),
    "ack": lambda r: InputsAcked(ids=list(_need(r, "ids")), **_common(r)),
    "amend": lambda r: InputAmended(src=_need(r, "src"), mode=_need(r, "mode"), text=_need(r, "text"), files=_files(r),
                                    **_common(r)),
    "tr": lambda r: WordsIn(src=_need(r, "src"), f=_need(r, "f"), tr=_need(r, "tr"), was=r.get("was"),
                            late=bool(r.get("late")), **_common(r)),
    "undo": lambda r: FilingUndone(src=_need(r, "src"), **_common(r)),
    "redo": lambda r: FilingRedone(src=_need(r, "src"), **_common(r)),
    "arch": lambda r: ItemsArchived(ns=list(_need(r, "ns")), on=bool(_need(r, "on")), follow=dict(r.get("follow") or {}),
                                    **_common(r)),
    "del": lambda r: InputDeleted(src=_need(r, "src"), ns=list(r.get("ns") or []), kept=list(r.get("kept") or []),
                                  **_common(r)),
    "undel": lambda r: InputRestored(src=_need(r, "src"), ns=list(r.get("ns") or []), **_common(r)),
    "moved": lambda r: InputMoved(src=_need(r, "src"), to=_need(r, "to"), as_=_need(r, "as"), **_common(r)),
    "org": lambda r: Organized(src=_need(r, "src"), ok=bool(r.get("ok")), msg=r.get("msg", ""), plan=r.get("plan"),
                               keep=r.get("keep"), changed=r.get("changed"), ms=r.get("ms"), retry=bool(r.get("retry")),
                               **_common(r)),
    "cfg": lambda r: ProjectRenamed(name=(_need(r, "f") or {}).get("name"), **_common(r)),
    "doc": lambda r: DocWritten(d=_need(r, "d"), n=_need(r, "n"), title=r.get("title") or "", md=_need(r, "md"),
                                fmt=r.get("fmt"), **_common(r)),
    "idel": lambda r: ItemsDeleted(ns=list(_need(r, "ns")), **_common(r)),
    "iundel": lambda r: ItemsRestored(ns=list(_need(r, "ns")), **_common(r)),
    "ddel": lambda r: DocDeleted(d=_need(r, "d"), on=bool(r.get("on", True)), **_common(r)),
    "dmove": lambda r: DocMoved(d=_need(r, "d"), to=_need(r, "to"), **_common(r)),
    "dcmove": lambda r: CommentMoved(d=_need(r, "d"), id=_need(r, "id"), key=_need(r, "key"), quote=r.get("quote", ""),
                                     **_common(r)),
    "unfile": lambda r: FileTakenOff(d=r.get("d"), id=r.get("id"), src=r.get("src"), f=_need(r, "f"), **_common(r)),
    "hide": lambda r: MessageHidden(n=_need(r, "n"), id=_need(r, "id"), on=bool(r.get("on", True)), **_common(r)),
    "rescope": lambda r: InputRescoped(src=_need(r, "src"), to=_need(r, "to"), **_common(r)),
    "dcres": lambda r: ThreadResolved(d=_need(r, "d"), key=_need(r, "key"), on=bool(r.get("on")), th=r.get("th"),
                                      **_common(r)),
    "dc": lambda r: CommentAdded(d=_need(r, "d"), key=_need(r, "key"), quote=_need(r, "quote"), text=_need(r, "text"),
                                 files=_files(r), th=r.get("th"), **_common(r)),
    "dcedit": lambda r: CommentEdited(d=_need(r, "d"), id=_need(r, "id"), text=_need(r, "text"), files=_files(r),
                                      **_common(r)),
    "dcdel": lambda r: CommentDeleted(d=_need(r, "d"), id=_need(r, "id"), **_common(r)),
    "dcundel": lambda r: CommentRestored(d=_need(r, "d"), id=_need(r, "id"), **_common(r)),
}

KINDS: Dict[str, Type[Event]] = {}
for _cls in list(globals().values()):
    if isinstance(_cls, type) and issubclass(_cls, Event) and getattr(_cls, "KIND", ""):
        KINDS[_cls.KIND] = _cls


def decode(row: Row) -> Event:
    """A stored row as an event; a kind this version does not know comes back as Unknown, kept as it is."""
    read = READERS.get(str(row.get("k", "")))
    if read is None:
        return Unknown(kind=str(row.get("k", "")), raw=dict(row), src=row.get("src"), **_common(row))
    try:
        return read(row)
    except (TypeError, ValueError, AttributeError) as ex:
        raise Unreadable(str(ex)) from ex
