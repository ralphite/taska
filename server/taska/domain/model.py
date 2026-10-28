"""The records of a project's current state: items, their messages, inputs, documents and their comments.

They are rebuilt from the change log (domain.projector) and written as JSON rows next to it (`to_row`), in the shape
the stored state tables have always had.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Any, Dict, List, Optional

Row = Dict[str, Any]


@dataclass(frozen=True)
class FileRef:
    """A file that came with an input, a message or a comment: taska-files/<f>."""

    f: str
    name: str
    mime: Optional[str] = None
    size: Optional[int] = None
    tr: Optional[str] = None  # a voice note's words
    wait: Optional[bool] = None  # a voice note whose words were still to come when it was sent

    @classmethod
    def from_row(cls, d: Any) -> FileRef:
        if isinstance(d, str):
            return cls(f=d, name=d.split("-", 1)[-1])
        return cls(f=str(d.get("f", "")), name=str(d.get("name", "")), mime=d.get("mime"), size=d.get("size"),
                   tr=d.get("tr"), wait=d.get("wait"))

    def to_row(self) -> Row:
        out: Row = {"f": self.f, "name": self.name}
        if self.mime is not None:
            out["mime"] = self.mime
        if self.size is not None:
            out["size"] = self.size
        if self.tr is not None:
            out["tr"] = self.tr
        if self.wait is not None:
            out["wait"] = self.wait
        return out

    def with_words(self, tr: str) -> FileRef:
        return replace(self, tr=tr)

    def with_wait(self, wait: Optional[bool]) -> FileRef:
        return replace(self, wait=wait)

    @property
    def is_audio(self) -> bool:
        return (self.mime or "").startswith("audio/")


def files_row(files: List[FileRef]) -> List[Row]:
    return [f.to_row() for f in files]


@dataclass
class Message:
    """One message in an item's talk: the user's (by "you"), the organizer's ("org") or an agent's."""

    id: int  # the change number that wrote it
    by: str
    kind: str
    text: str
    t: str
    src: Optional[str]  # the input it came from
    files: List[FileRef] = field(default_factory=list)
    ses: Optional[str] = None  # the agent's session
    to: Optional[List[str]] = None  # the agent sessions it names with @name
    edited: Optional[str] = None
    change: bool = False  # a note on an edit of the input, not the input's words
    hidden: Optional[bool] = None

    def to_row(self) -> Row:
        out: Row = {"id": self.id, "by": self.by, "kind": self.kind, "text": self.text, "t": self.t, "src": self.src,
                    "files": files_row(self.files)}
        if self.ses:
            out["ses"] = self.ses
        if self.to:
            out["to"] = list(self.to)
        if self.edited is not None:
            out["edited"] = self.edited
        if self.change:
            out["change"] = True
        if self.hidden is not None:
            out["hidden"] = self.hidden
        return out


@dataclass
class AgentMark:
    """Who works on an item and when it was last heard of there."""

    by: str
    t: str
    ses: Optional[str] = None

    def to_row(self) -> Row:
        return {"by": self.by, "t": self.t, **({"ses": self.ses} if self.ses else {})}


@dataclass
class Decision:
    """What the user decided on a proposal or on finished work: from proposed/review to the choice."""

    from_: str
    to: str
    msg: Optional[int]  # the agent's last message at the time
    t: str

    def to_row(self) -> Row:
        return {"from": self.from_, "to": self.to, "msg": self.msg, "t": self.t}


ITEM_FIELDS = ("title", "body", "next", "pri", "when", "status", "type", "parent", "archived", "rank")


@dataclass
class Item:
    n: int
    type: str
    title: str
    body: str
    pri: str
    when: str
    status: str
    parent: Optional[int]
    next: str
    t0: str
    t1: str
    by: Optional[str]  # who made it
    thread: List[Message] = field(default_factory=list)
    srcs: List[str] = field(default_factory=list)  # the inputs it came from or that added to it
    merged_into: Optional[int] = None
    archived: bool = False
    agent: Optional[AgentMark] = None
    rank: Optional[float] = None  # the user's order within a priority (smaller first); None: by priority
    decided: Optional[Decision] = None
    deleted: Optional[str] = None  # the input it was deleted with, or "#item" when deleted by itself
    deleted_at: Optional[str] = None

    def get(self, name: str) -> Any:
        """A field that a change can set (ITEM_FIELDS)."""
        return getattr(self, name)

    def put(self, name: str, value: Any) -> None:
        if name in ITEM_FIELDS:
            setattr(self, name, value)

    @property
    def live(self) -> bool:
        """Not merged into another item and not deleted."""
        return self.merged_into is None and not self.deleted

    def to_row(self) -> Row:
        out: Row = {"n": self.n, "type": self.type, "title": self.title, "body": self.body, "pri": self.pri,
                    "when": self.when, "status": self.status, "parent": self.parent, "next": self.next,
                    "thread": [m.to_row() for m in self.thread], "srcs": list(self.srcs),
                    "merged_into": self.merged_into, "archived": self.archived, "t0": self.t0, "t1": self.t1,
                    "by": self.by}
        if self.agent:
            out["agent"] = self.agent.to_row()
        if self.rank is not None:
            out["rank"] = self.rank
        if self.decided:
            out["decided"] = self.decided.to_row()
        if self.deleted:
            out["deleted"] = self.deleted
        if self.deleted_at:
            out["deleted_at"] = self.deleted_at
        return out


@dataclass
class OrgNote:
    """What the organizer did with an input, as the page and /inbox say it."""

    ok: bool
    msg: str
    t: str
    keep: bool  # left for the coding agent
    changed: Optional[bool] = None
    undone: bool = False

    def to_row(self) -> Row:
        out: Row = {"ok": self.ok, "msg": self.msg, "t": self.t, "keep": self.keep}
        if self.changed is not None:
            out["changed"] = self.changed
        if self.undone:
            out["undone"] = True
        return out


@dataclass
class InputVersion:
    text: str
    t: str
    mode: str  # edit, append

    def to_row(self) -> Row:
        return {"text": self.text, "t": self.t, "mode": self.mode}


@dataclass
class InputDeletion:
    """An input in Deleted: when, by which change, the items that went with it and those that stayed (and why)."""

    t: str
    seq: int
    ns: List[int]
    kept: List[List[Any]]  # [n, why]

    def to_row(self) -> Row:
        return {"t": self.t, "seq": self.seq, "ns": list(self.ns), "kept": [list(k) for k in self.kept]}


@dataclass
class Moved:
    """An input sent to the wrong project lives on in `to` as `as_`."""

    to: str
    as_: str

    def to_row(self) -> Row:
        return {"to": self.to, "as": self.as_}


@dataclass
class Input:
    """What the user said, verbatim: a new input to the project, or a reply on an item (scope)."""

    id: str  # r12
    t: str
    by: str
    text: str
    scope: Optional[int]
    files: List[FileRef]
    seq: int  # the change that made it
    acked: bool = False  # handled
    touched: List[int] = field(default_factory=list)  # the items it made or changed
    org: Optional[OrgNote] = None
    kind: Optional[str] = None  # "answer": a form sent on its item, filed as it is
    history: List[InputVersion] = field(default_factory=list)
    v: int = 0  # bumps on every change of its words
    edit_seq: int = 0
    updated: Optional[str] = None
    moved: Optional[Moved] = None
    deleted: Optional[InputDeletion] = None

    @property
    def number(self) -> int:
        return int(self.id[1:])

    def to_row(self) -> Row:
        out: Row = {"id": self.id, "t": self.t, "by": self.by, "text": self.text, "scope": self.scope,
                    "files": files_row(self.files), "acked": self.acked, "touched": list(self.touched),
                    "org": self.org.to_row() if self.org else None, "seq": self.seq}
        if self.kind:
            out["kind"] = self.kind
        if self.history:
            out["history"] = [h.to_row() for h in self.history]
            out["v"], out["edit_seq"], out["updated"] = self.v, self.edit_seq, self.updated
        elif self.v:
            out["v"] = self.v
        if self.moved:
            out["moved"] = self.moved.to_row()
        if self.deleted:
            out["deleted"] = self.deleted.to_row()
        return out


@dataclass
class Comment:
    """A comment in a document: on a paragraph (key), the document as a whole (DOC_KEY) or a part of a web page."""

    id: int
    key: str
    th: int  # its thread within the paragraph: each place selected has its own
    quote: str
    text: str
    by: str
    t: str
    files: List[FileRef] = field(default_factory=list)
    edited: Optional[str] = None

    def to_row(self) -> Row:
        out: Row = {"id": self.id, "key": self.key, "th": self.th, "quote": self.quote, "text": self.text,
                    "by": self.by, "t": self.t, "files": files_row(self.files)}
        if self.edited is not None:
            out["edited"] = self.edited
        return out


@dataclass
class Doc:
    """A document on an item: Markdown (the default) or a web page (fmt "html"), with its comments."""

    d: int
    n: int  # the item it belongs to
    t0: str
    title: str = ""
    md: str = ""
    t1: str = ""
    by: str = ""
    versions: int = 0
    fmt: Optional[str] = None
    comments: List[Comment] = field(default_factory=list)
    deleted: Optional[str] = None
    resolved: Dict[str, str] = field(default_factory=dict)  # "<key>#<thread>" -> when
    gone: Dict[int, Comment] = field(default_factory=dict)  # deleted comments, for a restore

    @property
    def is_page(self) -> bool:
        return self.fmt == "html"

    def comment(self, cid: int) -> Optional[Comment]:
        return next((c for c in self.comments if c.id == cid), None)

    def to_row(self) -> Row:
        out: Row = {"d": self.d, "n": self.n, "comments": [c.to_row() for c in self.comments], "t0": self.t0,
                    "versions": self.versions, "title": self.title, "md": self.md, "t1": self.t1, "by": self.by}
        if self.fmt:
            out["fmt"] = self.fmt
        if self.deleted:
            out["deleted"] = self.deleted
        if self.resolved:
            out["resolved"] = dict(self.resolved)
        if self.gone:
            out["gone"] = {str(k): c.to_row() for k, c in self.gone.items()}
        return out
