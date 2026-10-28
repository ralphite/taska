"""Changes to items and their talk, and the project's name: typed events and how their stored rows read."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, ClassVar, Dict, List, Optional

from ..model import FileRef, Row, files_row
from ..text import clean_title
from .base import Event, Reader, common, files_of, need, opt


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
        opt(row, "keep", True, self.keep)
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
        opt(row, "cascade", self.cascade, self.cascade is not None)
        opt(row, "keep", True, self.keep)
        opt(row, "undo_of", self.undo_of, bool(self.undo_of))
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
        opt(row, "files", files_row(self.files), bool(self.files))
        opt(row, "to", list(self.to), bool(self.to))
        opt(row, "keep", True, self.keep)
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
        opt(row, "keep", True, self.keep)
        return row

    def items_touched(self) -> List[int]:
        return [x for x in (self.n, self.into) if x]


@dataclass
class ItemsArchived(Event):
    """Many items archived or brought back in one change; `follow`: subitem -> the item it went along with."""

    KIND: ClassVar[str] = "arch"
    ns: List[int] = field(default_factory=list)
    on: bool = True
    follow: Dict[str, int] = field(default_factory=dict)

    def body(self) -> Row:
        row: Row = {"ns": list(self.ns), "on": self.on, "by": self.by}
        opt(row, "follow", dict(self.follow), bool(self.follow))
        return row

    def items_touched(self) -> List[int]:
        return list(self.ns)


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
class ProjectRenamed(Event):
    KIND: ClassVar[str] = "cfg"
    name: Optional[str] = None

    def body(self) -> Row:
        return {"f": {"name": self.name} if self.name is not None else {}, "by": self.by}


READERS: Dict[str, Reader] = {
    "add": lambda r: ItemAdded(n=need(r, "n"), title=need(r, "title"), src=r.get("src"), type=need(r, "type"),
                               pri=need(r, "pri"), when=need(r, "when"), status=need(r, "status"),
                               body_text=r.get("body", ""), next=r.get("next", ""), parent=r.get("parent"),
                               keep=bool(r.get("keep")), **common(r)),
    "set": lambda r: FieldsSet(n=need(r, "n"), f=dict(need(r, "f")), was=dict(r.get("was") or {}), src=r.get("src"),
                               keep=bool(r.get("keep")), undo_of=r.get("undo_of"), cascade=r.get("cascade"),
                               **common(r)),
    "say": lambda r: MessagePosted(n=need(r, "n"), kind=need(r, "kind"), text=need(r, "text"), src=r.get("src"),
                                   files=files_of(r), to=list(r.get("to") or []), keep=bool(r.get("keep")), **common(r)),
    "merge": lambda r: ItemMerged(n=need(r, "n"), into=need(r, "into"), src=r.get("src"), keep=bool(r.get("keep")),
                                  **common(r)),
    "arch": lambda r: ItemsArchived(ns=list(need(r, "ns")), on=bool(need(r, "on")), follow=dict(r.get("follow") or {}),
                                    **common(r)),
    "idel": lambda r: ItemsDeleted(ns=list(need(r, "ns")), **common(r)),
    "iundel": lambda r: ItemsRestored(ns=list(need(r, "ns")), **common(r)),
    "hide": lambda r: MessageHidden(n=need(r, "n"), id=need(r, "id"), on=bool(r.get("on", True)), **common(r)),
    "unfile": lambda r: FileTakenOff(d=r.get("d"), id=r.get("id"), src=r.get("src"), f=need(r, "f"), **common(r)),
    "cfg": lambda r: ProjectRenamed(name=(need(r, "f") or {}).get("name"), **common(r)),
}
