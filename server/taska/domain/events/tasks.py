"""Changes to tasks and their talk, and the project's name and picture: typed events and how their stored rows read."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, ClassVar, Dict, List, Optional

from ..model import FileRef, Row, files_row
from ..text import clean_title
from .base import Event, Reader, common, files_of, need, opt


@dataclass
class TaskAdded(Event):
    KIND: ClassVar[str] = "add"
    n: int = 0
    title: str = ""  # as written; `clean` is what the task gets
    tags: List[str] = field(default_factory=list)
    pri: str = "P1"  # DEFAULT_PRI (r1072); stored events always say theirs
    when: str = "now"
    status: str = "open"
    body_text: str = ""
    next: str = ""
    parent: Optional[int] = None
    keep: bool = False  # linked to src, but src stays unhandled
    group: bool = False  # a group (T856)
    after: List[int] = field(default_factory=list)  # the tasks it waits for (T857)

    def body(self) -> Row:
        row: Row = {"n": self.n, "by": self.by, "title": self.title, "src": self.src, "tags": list(self.tags),
                    "pri": self.pri, "when": self.when, "status": self.status, "body": self.body_text,
                    "next": self.next, "parent": self.parent}
        opt(row, "keep", True, self.keep)
        opt(row, "group", True, self.group)
        opt(row, "after", list(self.after), bool(self.after))
        return row

    @property
    def clean(self) -> str:
        return clean_title(self.title)[0]

    def tasks_touched(self) -> List[int]:
        return [x for x in (self.n, self.parent, *self.after) if x]


@dataclass
class FieldsSet(Event):
    """Fields of a task changed; `was` holds what they were."""

    KIND: ClassVar[str] = "set"
    n: int = 0
    f: Dict[str, Any] = field(default_factory=dict)
    was: Dict[str, Any] = field(default_factory=dict)
    keep: bool = False
    undo_of: Optional[int] = None  # the change of yours this puts back
    cascade: Optional[int] = None  # the task this followed (a change to a parent goes to its subtasks)

    def body(self) -> Row:
        row: Row = {"n": self.n, "by": self.by, "f": dict(self.f), "was": dict(self.was), "src": self.src}
        opt(row, "cascade", self.cascade, self.cascade is not None)
        opt(row, "keep", True, self.keep)
        opt(row, "undo_of", self.undo_of, bool(self.undo_of))
        return row

    @property
    def fields(self) -> Dict[str, Any]:
        """The new values as the task holds them (a title without the guide's options in it)."""
        if "title" in self.f:
            return dict(self.f, title=clean_title(str(self.f["title"]))[0])
        return self.f

    def tasks_touched(self) -> List[int]:
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

    def tasks_touched(self) -> List[int]:
        return [self.n] if self.n else []


@dataclass
class TaskMerged(Event):
    KIND: ClassVar[str] = "merge"
    n: int = 0
    into: int = 0
    keep: bool = False

    def body(self) -> Row:
        row: Row = {"n": self.n, "into": self.into, "by": self.by, "src": self.src}
        opt(row, "keep", True, self.keep)
        return row

    def tasks_touched(self) -> List[int]:
        return [x for x in (self.n, self.into) if x]


@dataclass
class TaskUnmerged(Event):
    """A merged task taken back out of the one it went into (`into`), as it was, to be retired or kept."""

    KIND: ClassVar[str] = "unmerge"
    n: int = 0
    into: int = 0

    def body(self) -> Row:
        return {"n": self.n, "into": self.into, "by": self.by, "src": self.src}

    def tasks_touched(self) -> List[int]:
        return [x for x in (self.n, self.into) if x]


@dataclass
class TasksArchived(Event):
    """Many tasks archived or brought back in one change; `follow`: subtask -> the task it went along with."""

    KIND: ClassVar[str] = "arch"
    ns: List[int] = field(default_factory=list)
    on: bool = True
    follow: Dict[str, int] = field(default_factory=dict)

    def body(self) -> Row:
        row: Row = {"ns": list(self.ns), "on": self.on, "by": self.by}
        opt(row, "follow", dict(self.follow), bool(self.follow))
        return row

    def tasks_touched(self) -> List[int]:
        return list(self.ns)


@dataclass
class TasksDeleted(Event):
    """A task deleted by itself, with its subtasks."""

    KIND: ClassVar[str] = "idel"
    ns: List[int] = field(default_factory=list)

    def body(self) -> Row:
        return {"ns": list(self.ns), "by": self.by}

    def tasks_touched(self) -> List[int]:
        return list(self.ns)


@dataclass
class TasksRestored(Event):
    KIND: ClassVar[str] = "iundel"
    ns: List[int] = field(default_factory=list)

    def body(self) -> Row:
        return {"ns": list(self.ns), "by": self.by}

    def tasks_touched(self) -> List[int]:
        return list(self.ns)


@dataclass
class MessageHidden(Event):
    KIND: ClassVar[str] = "hide"
    n: int = 0
    id: int = 0
    on: bool = True

    def body(self) -> Row:
        return {"n": self.n, "id": self.id, "on": self.on, "by": self.by}

    def tasks_touched(self) -> List[int]:
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
class LaterEnded(Event):
    """A task put Later until a day: the day came, it is back to Now (D115 #21)."""

    KIND: ClassVar[str] = "due"
    n: int = 0

    def body(self) -> Row:
        return {"n": self.n, "by": self.by}

    def tasks_touched(self) -> List[int]:
        return [self.n] if self.n else []


@dataclass
class ProjectRenamed(Event):
    KIND: ClassVar[str] = "cfg"
    name: Optional[str] = None

    def body(self) -> Row:
        return {"f": {"name": self.name} if self.name is not None else {}, "by": self.by}


@dataclass
class ProjectIconSet(Event):
    """The project's picture (F743): a file it has, shown in place of its letter; "" takes it off."""

    KIND: ClassVar[str] = "icon"
    f: str = ""

    def body(self) -> Row:
        return {"f": self.f, "by": self.by}


def _tags_of(r: Row) -> List[str]:
    """A task's tags as a change wrote them. Changes from before T855 wrote a type instead: bug reads as the tag bug,
    the other types as no tag (the user's choice, r1459)."""
    if "tags" in r:
        return [str(x) for x in r["tags"] or []]
    return ["bug"] if r.get("type") == "bug" else []


def _fields(d: Any) -> Dict[str, Any]:
    """The fields a set changed (or what they were), an old type read as tags (see _tags_of)."""
    out = dict(d or {})
    if "type" in out:
        out["tags"] = _tags_of({"type": out.pop("type")})
    return out


READERS: Dict[str, Reader] = {
    "add": lambda r: TaskAdded(n=need(r, "n"), title=need(r, "title"), src=r.get("src"), tags=_tags_of(r),
                               pri=need(r, "pri"), when=need(r, "when"), status=need(r, "status"),
                               body_text=r.get("body", ""), next=r.get("next", ""), parent=r.get("parent"),
                               keep=bool(r.get("keep")), group=bool(r.get("group")), after=[int(x) for x in r.get("after") or []], **common(r)),
    "set": lambda r: FieldsSet(n=need(r, "n"), f=_fields(need(r, "f")), was=_fields(r.get("was")), src=r.get("src"),
                               keep=bool(r.get("keep")), undo_of=r.get("undo_of"), cascade=r.get("cascade"),
                               **common(r)),
    "say": lambda r: MessagePosted(n=need(r, "n"), kind=need(r, "kind"), text=need(r, "text"), src=r.get("src"),
                                   files=files_of(r), to=list(r.get("to") or []), keep=bool(r.get("keep")), **common(r)),
    "merge": lambda r: TaskMerged(n=need(r, "n"), into=need(r, "into"), src=r.get("src"), keep=bool(r.get("keep")),
                                  **common(r)),
    "unmerge": lambda r: TaskUnmerged(n=need(r, "n"), into=need(r, "into"), src=r.get("src"), **common(r)),
    "arch": lambda r: TasksArchived(ns=list(need(r, "ns")), on=bool(need(r, "on")), follow=dict(r.get("follow") or {}),
                                    **common(r)),
    "idel": lambda r: TasksDeleted(ns=list(need(r, "ns")), **common(r)),
    "iundel": lambda r: TasksRestored(ns=list(need(r, "ns")), **common(r)),
    "hide": lambda r: MessageHidden(n=need(r, "n"), id=need(r, "id"), on=bool(r.get("on", True)), **common(r)),
    "unfile": lambda r: FileTakenOff(d=r.get("d"), id=r.get("id"), src=r.get("src"), f=need(r, "f"), **common(r)),
    "due": lambda r: LaterEnded(n=need(r, "n"), **common(r)),
    "cfg": lambda r: ProjectRenamed(name=(need(r, "f") or {}).get("name"), **common(r)),
    "icon": lambda r: ProjectIconSet(f=str(need(r, "f") or ""), **common(r)),
}
