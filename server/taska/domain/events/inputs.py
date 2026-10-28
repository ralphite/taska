"""What was said and what became of it (the organizer's filing, words from voice, moves): typed events and how
their stored rows read."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, ClassVar, Dict, List, Optional

from ..model import FileRef, Row, files_row
from .base import Event, Reader, common, files_of, need, opt


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
        opt(row, "q", self.q, bool(self.q))
        opt(row, "kind", self.kind, bool(self.kind))
        return row

    def items_touched(self) -> List[int]:
        return [self.scope] if self.scope else []


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
        opt(row, "files", files_row(self.files), bool(self.files))
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
        opt(row, "was", self.was, self.was is not None)
        row["by"] = self.by
        opt(row, "late", True, self.late)
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
        opt(row, "plan", self.plan, self.plan is not None)
        opt(row, "keep", self.keep, self.keep is not None)
        opt(row, "changed", self.changed, self.changed is not None)
        opt(row, "ms", self.ms, self.ms is not None)
        row["by"] = self.by
        return row


@dataclass
class InputRescoped(Event):
    """What you said goes with another item."""

    KIND: ClassVar[str] = "rescope"
    to: int = 0

    def body(self) -> Row:
        return {"src": self.src, "to": self.to, "by": self.by}


READERS: Dict[str, Reader] = {
    "in": lambda r: InputAdded(id=need(r, "id"), text=r.get("text", ""), scope=r.get("scope"), files=files_of(r),
                               q=r.get("q") or "", kind=r.get("kind"), **common(r)),
    "ack": lambda r: InputsAcked(ids=list(need(r, "ids")), **common(r)),
    "amend": lambda r: InputAmended(src=need(r, "src"), mode=need(r, "mode"), text=need(r, "text"), files=files_of(r),
                                    **common(r)),
    "tr": lambda r: WordsIn(src=need(r, "src"), f=need(r, "f"), tr=need(r, "tr"), was=r.get("was"),
                            late=bool(r.get("late")), **common(r)),
    "undo": lambda r: FilingUndone(src=need(r, "src"), **common(r)),
    "redo": lambda r: FilingRedone(src=need(r, "src"), **common(r)),
    "del": lambda r: InputDeleted(src=need(r, "src"), ns=list(r.get("ns") or []), kept=list(r.get("kept") or []),
                                  **common(r)),
    "undel": lambda r: InputRestored(src=need(r, "src"), ns=list(r.get("ns") or []), **common(r)),
    "moved": lambda r: InputMoved(src=need(r, "src"), to=need(r, "to"), as_=need(r, "as"), **common(r)),
    "org": lambda r: Organized(src=need(r, "src"), ok=bool(r.get("ok")), msg=r.get("msg", ""), plan=r.get("plan"),
                               keep=r.get("keep"), changed=r.get("changed"), ms=r.get("ms"), retry=bool(r.get("retry")),
                               **common(r)),
    "rescope": lambda r: InputRescoped(src=need(r, "src"), to=need(r, "to"), **common(r)),
}
